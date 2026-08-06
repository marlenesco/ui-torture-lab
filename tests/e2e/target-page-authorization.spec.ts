// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";
import path from "node:path";
import puppeteer, {
  type Browser,
  type Extension,
  type Page,
  type Target,
  type WebWorker,
} from "puppeteer-core";

type ActionState = {
  readonly badge: string;
  readonly title: string;
};

type ExtensionChromeApi = {
  readonly action: {
    getBadgeText(details: { readonly tabId: number }): Promise<string>;
    getTitle(details: { readonly tabId: number }): Promise<string>;
  };
  readonly tabs: {
    query(details: { readonly active: true; readonly currentWindow: true }): Promise<
      Array<{ readonly id?: number }>
    >;
  };
};

test.describe.configure({ mode: "serial" });

let browser: Browser;
let extension: Extension;
let serviceWorkerTarget: Target;
let serviceWorker: WebWorker;

const readActiveTabActionState = async (): Promise<ActionState> =>
  serviceWorker.evaluate(async () => {
    const chromeApi = (globalThis as unknown as { chrome: ExtensionChromeApi })
      .chrome;
    const [tab] = await chromeApi.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab?.id === undefined) {
      throw new Error("No active Chrome tab was available to inspect");
    }

    return {
      badge: await chromeApi.action.getBadgeText({ tabId: tab.id }),
      title: await chromeApi.action.getTitle({ tabId: tab.id }),
    };
  });

const triggerToolbarAction = async (page: Page): Promise<void> => {
  await page.bringToFront();
  await page.triggerExtensionAction(extension);
};

test.beforeAll(async () => {
  browser = await puppeteer.launch({
    executablePath: await puppeteer.executablePath("chrome"),
    headless: true,
    enableExtensions: true,
  });

  const extensionId = await browser.installExtension(
    path.resolve("apps/extension/.output/chrome-mv3"),
  );
  const installedExtension = (await browser.extensions()).get(extensionId);
  if (installedExtension === undefined) {
    throw new Error("Built UI Torture Lab extension was not installed");
  }
  extension = installedExtension;

  serviceWorkerTarget = await browser.waitForTarget(
    (target) =>
      target.type() === "service_worker" && target.url().includes(extensionId),
  );
  const installedServiceWorker = await serviceWorkerTarget.worker();
  if (installedServiceWorker === null) {
    throw new Error("Built UI Torture Lab service worker was not available");
  }
  serviceWorker = installedServiceWorker;
});

test.afterAll(async () => {
  await browser.close();
});

test("toolbar authorizes the actual built extension on localhost", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/smoke/");

    await triggerToolbarAction(page);

    await expect.poll(readActiveTabActionState).toEqual({
      badge: "OK",
      title: "UI Torture Lab — Target Page authorized",
    });
  } finally {
    await page.close();
  }
});

test("toolbar authorizes the actual built extension on synthetic HTTPS", async () => {
  const page = await browser.newPage();
  try {
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.url() === "https://fixture.test/supported/") {
        void request.respond({
          contentType: "text/html; charset=utf-8",
          body: "<!doctype html><title>HTTPS fixture</title><h1>HTTPS fixture</h1>",
        });
        return;
      }
      void request.continue();
    });
    await page.goto("https://fixture.test/supported/");

    await triggerToolbarAction(page);

    await expect.poll(readActiveTabActionState).toEqual({
      badge: "OK",
      title: "UI Torture Lab — Target Page authorized",
    });
  } finally {
    await page.close();
  }
});

test("toolbar rejects an unsupported top-level protocol without injection", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("data:text/html,<title>Unsupported fixture</title>");

    await triggerToolbarAction(page);

    await expect.poll(readActiveTabActionState).toEqual({
      badge: "!",
      title:
        "This page is not supported. UI Torture Lab runs only on HTTP or HTTPS HTML pages. Serve local files through localhost.",
    });
  } finally {
    await page.close();
  }
});

test("toolbar rejects a same-URL reload between probe and bootstrap", async () => {
  const page = await browser.newPage();
  const debuggerSession = await serviceWorkerTarget.createCDPSession();
  let workerPaused = false;
  try {
    await page.goto("http://127.0.0.1:4173/smoke/");
    await page.bringToFront();

    const backgroundScript = new Promise<{ readonly scriptId: string }>(
      (resolve) => {
        const onScriptParsed = (event: {
          readonly scriptId: string;
          readonly url: string;
        }): void => {
          if (event.url.endsWith("/background.js")) {
            debuggerSession.off("Debugger.scriptParsed", onScriptParsed);
            resolve(event);
          }
        };
        debuggerSession.on("Debugger.scriptParsed", onScriptParsed);
      },
    );
    await debuggerSession.send("Debugger.enable");
    const { scriptId } = await backgroundScript;
    const { scriptSource } = await debuggerSession.send(
      "Debugger.getScriptSource",
      { scriptId },
    );

    const injectionCall = "scripting.executeScript";
    const firstInjection = scriptSource.indexOf(injectionCall);
    const secondInjection = scriptSource.indexOf(
      injectionCall,
      firstInjection + injectionCall.length,
    );
    expect(firstInjection).toBeGreaterThanOrEqual(0);
    expect(secondInjection).toBeGreaterThan(firstInjection);

    const sourceBeforeBreakpoint = scriptSource.slice(0, secondInjection);
    const sourceLines = sourceBeforeBreakpoint.split("\n");
    const lineNumber = sourceLines.length - 1;
    const columnNumber = sourceLines.at(-1)?.length ?? 0;
    await debuggerSession.send("Debugger.setBreakpoint", {
      location: { scriptId, lineNumber, columnNumber },
    });

    const paused = new Promise<void>((resolve) => {
      debuggerSession.once("Debugger.paused", () => {
        workerPaused = true;
        resolve();
      });
    });
    const toolbarAction = page.triggerExtensionAction(extension);
    await paused;

    await page.reload();
    await debuggerSession.send("Debugger.resume");
    workerPaused = false;
    await toolbarAction;

    await expect.poll(readActiveTabActionState).toEqual({
      badge: "!",
      title:
        "The page changed before authorization completed. Click the toolbar action again.",
    });
  } finally {
    if (workerPaused) {
      await debuggerSession.send("Debugger.resume").catch(() => undefined);
    }
    await debuggerSession.detach().catch(() => undefined);
    await page.close();
  }
});
