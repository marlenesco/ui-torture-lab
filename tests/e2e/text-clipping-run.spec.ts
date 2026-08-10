// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";
import path from "node:path";
import puppeteer, {
  type Browser,
  type Extension,
  type WebWorker,
} from "puppeteer-core";

test.describe.configure({ mode: "serial" });

let browser: Browser;
let extension: Extension;
let serviceWorker: WebWorker;

type ChromeApi = {
  readonly scripting: {
    executeScript<TResult>(details: {
      readonly func: () => TResult | Promise<TResult>;
      readonly target: { readonly frameIds: number[]; readonly tabId: number };
      readonly world: "ISOLATED";
    }): Promise<Array<{ readonly result?: TResult }>>;
  };
  readonly tabs: {
    query(details: { readonly active: true; readonly currentWindow: true }): Promise<
      Array<{ readonly id?: number }>
    >;
  };
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
  const target = await browser.waitForTarget(
    (candidate) =>
      candidate.type() === "service_worker" && candidate.url().includes(extensionId),
  );
  const worker = await target.worker();
  if (worker === null) {
    throw new Error("Built UI Torture Lab service worker was unavailable");
  }
  serviceWorker = worker;
});

test.afterAll(async () => {
  await browser.close();
});

test("built extension groups the completed Finding under Text Clipping", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/text-clipping-run/");
    await page.bringToFront();
    await page.triggerExtensionAction(extension);
    await page.waitForSelector("[data-ui-torture-lab-root]");
    await serviceWorker.evaluate(async () => {
      const chromeApi = (globalThis as unknown as { chrome: ChromeApi }).chrome;
      const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) {
        throw new Error("No active fixture tab was available");
      }
      const [injection] = await chromeApi.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        world: "ISOLATED",
        func: async () => {
          type Controller = {
            getSnapshot(): {
              readonly findings: readonly { readonly locator: string }[];
              readonly result: { readonly findings: readonly { readonly locator: string }[] } | null;
            };
            restore(): void;
            startScenario(scenarioId: "long-text"): Promise<void>;
          };
          const runtime = (globalThis as typeof globalThis & {
            [key: symbol]: { readonly runController?: Controller } | undefined;
          })[Symbol.for("ui-torture-lab/document-runtime")];
          if (runtime?.runController === undefined) {
            throw new Error("Run Controller was not available");
          }
          await runtime.runController.startScenario("long-text");
          return runtime.runController.getSnapshot().findings;
        },
      });
      return injection?.result;
    });
    const activePanelText = await page.evaluate(
      () =>
        document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
          ?.textContent ?? "",
    );
    expect(activePanelText).toContain("Text Clipping");
    expect(activePanelText).toContain("Boundary p#clipping-boundary");
    const result = await serviceWorker.evaluate(async () => {
      const chromeApi = (globalThis as unknown as { chrome: ChromeApi }).chrome;
      const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) throw new Error("No active fixture tab was available");
      const [injection] = await chromeApi.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        world: "ISOLATED",
        func: () => {
          type Controller = {
            getSnapshot(): {
              readonly result: { readonly findings: readonly { readonly locator: string }[] } | null;
            };
            restore(): void;
          };
          const runtime = (globalThis as typeof globalThis & {
            [key: symbol]: { readonly runController?: Controller } | undefined;
          })[Symbol.for("ui-torture-lab/document-runtime")];
          if (runtime?.runController === undefined) throw new Error("Run Controller was not available");
          runtime.runController.restore();
          return runtime.runController.getSnapshot().result;
        },
      });
      return injection?.result;
    });
    expect(result?.findings).toContainEqual(
      expect.objectContaining({ locator: "p#clipping-boundary" }),
    );
  } finally {
    await page.close();
  }
});

test("built extension shows containment and Viewport Overflow from Unbreakable Text", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/horizontal-containment-run/");
    await page.bringToFront();
    await page.triggerExtensionAction(extension);
    await page.waitForSelector("[data-ui-torture-lab-root]");
    await serviceWorker.evaluate(async () => {
      const chromeApi = (globalThis as unknown as { chrome: ChromeApi }).chrome;
      const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) throw new Error("No active fixture tab was available");
      await chromeApi.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        world: "ISOLATED",
        func: async () => {
          type Controller = { startScenario(scenarioId: "unbreakable-text"): Promise<void> };
          const runtime = (globalThis as typeof globalThis & {
            [key: symbol]: { readonly runController?: Controller } | undefined;
          })[Symbol.for("ui-torture-lab/document-runtime")];
          if (runtime?.runController === undefined) throw new Error("Run Controller was unavailable");
          await runtime.runController.startScenario("unbreakable-text");
        },
      });
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-ui-torture-lab-root]")
          ?.shadowRoot?.textContent?.includes("Unbreakable Text Scenario active") ===
        true,
      { timeout: 5_000 },
    );
    const panelText = await page.evaluate(
      () => document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.textContent ?? "",
    );
    expect(panelText).toContain("Findings");
    expect(panelText).toContain("Boundary div#containing-boundary");
    expect(panelText).toContain("Target Page");
    expect(panelText).toContain("via p#viewport-child");
    expect(panelText).toContain("Contributors: inline-end p#viewport-child");
    expect(panelText).toContain("baseline");
    expect(panelText).toContain("delta");
    expect(panelText).toContain("extends the Target Page beyond its layout viewport");
  } finally {
    await page.close();
  }
});
