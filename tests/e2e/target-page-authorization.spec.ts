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

type FixtureGeometry = {
  readonly bodyScrollWidth: number;
  readonly breakpoint: string;
  readonly clientWidth: number;
  readonly documentScrollWidth: number;
  readonly innerWidth: number;
  readonly resizeCount: number;
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
  readonly scripting: {
    executeScript<TResult>(details: {
      readonly target: { readonly frameIds: number[]; readonly tabId: number };
      readonly world: "ISOLATED";
      readonly func: () => TResult | Promise<TResult>;
    }): Promise<Array<{ readonly result?: TResult }>>;
  };
};

type RuntimeDiagnostics = {
  readonly diagnosticHighlightCount: number;
  readonly diagnosticHighlightsRendered: number;
  readonly ownedRootCount: number;
  readonly overlayRendered: boolean;
  readonly panelRendered: boolean;
  readonly ownsOverlay: boolean;
  readonly ownsPanel: boolean;
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

const readFixtureGeometry = async (page: Page): Promise<FixtureGeometry> =>
  page.evaluate(() => {
    const breakpointState = document.querySelector("#breakpoint-state");
    if (breakpointState === null) {
      throw new Error("Controlled fixture breakpoint state was unavailable");
    }
    return {
      bodyScrollWidth: document.body.scrollWidth,
      breakpoint: getComputedStyle(breakpointState, "::after").content,
      clientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      resizeCount: (window as typeof window & { fixtureResizeCount: number })
        .fixtureResizeCount,
    };
  });

const exerciseMeasurementSafeRuntime = async (): Promise<{
  readonly after: RuntimeDiagnostics;
  readonly before: RuntimeDiagnostics;
  readonly during: RuntimeDiagnostics;
}> =>
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

    const [injection] = await chromeApi.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      world: "ISOLATED",
      func: async () => {
        type RuntimeProbe = {
          clearDiagnosticHighlights(): void;
          getDiagnostics(): RuntimeDiagnostics;
          showDiagnosticHighlight(rect: {
            readonly height: number;
            readonly width: number;
            readonly x: number;
            readonly y: number;
          }): void;
          withMeasurementSafeUi<T>(measure: () => T): Promise<T>;
        };

        const key = Symbol.for("ui-torture-lab/document-runtime");
        const runtime = (globalThis as typeof globalThis & {
          [key]?: RuntimeProbe;
        })[key];
        if (runtime === undefined) {
          throw new Error("Document Runtime was not available");
        }

        runtime.showDiagnosticHighlight({
          x: 24,
          y: 24,
          width: 120,
          height: 40,
        });
        const before = runtime.getDiagnostics();
        const during = await runtime.withMeasurementSafeUi(() =>
          runtime.getDiagnostics(),
        );
        const after = runtime.getDiagnostics();
        runtime.clearDiagnosticHighlights();
        return { before, during, after };
      },
    });

    if (injection?.result === undefined) {
      throw new Error("Document Runtime probe returned no result");
    }
    return injection.result;
  });

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

test("toolbar mounts one floating control shell without geometry contamination", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(
      "http://127.0.0.1:4173/extension-ui-contamination/",
    );
    const before = await readFixtureGeometry(page);

    await triggerToolbarAction(page);
    await page.waitForSelector("[data-ui-torture-lab-root]");
    await page.waitForFunction(() =>
      document
        .querySelector("[data-ui-torture-lab-root]")
        ?.shadowRoot?.querySelector(".panel-shell"),
    );

    const after = await readFixtureGeometry(page);
    const panel = await page.evaluate(() => {
      const hosts = document.querySelectorAll("[data-ui-torture-lab-root]");
      const host = hosts[0];
      if (!(host instanceof HTMLElement)) {
        throw new Error("Floating panel host was not mounted");
      }
      const rect = host.getBoundingClientRect();
      return {
        hostCount: hosts.length,
        inlineEnd: rect.right,
        inlineStart: rect.left,
        runtimeId: host.dataset.uiTortureLabRuntimeId,
        surface: host.dataset.uiTortureLabSurface,
      };
    });

    expect(after).toEqual(before);
    expect(panel).toMatchObject({
      hostCount: 1,
      surface: "floating-panel",
    });
    expect(panel.runtimeId).toBeTruthy();
    expect(panel.inlineStart).toBeGreaterThanOrEqual(0);
    expect(panel.inlineEnd).toBeLessThanOrEqual(before.innerWidth);
  } finally {
    await page.close();
  }
});

test("floating UI events stop before Target Page bubble handlers", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(
      "http://127.0.0.1:4173/extension-ui-contamination/",
    );
    await triggerToolbarAction(page);
    await page.waitForFunction(() =>
      document
        .querySelector("[data-ui-torture-lab-root]")
        ?.shadowRoot?.querySelector('[aria-label="Collapse UI Torture Lab"]'),
    );

    const observed = await page.evaluate(() => {
      const host = document.querySelector("[data-ui-torture-lab-root]");
      const collapse = host?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[aria-label="Collapse UI Torture Lab"]',
      );
      if (collapse === null || collapse === undefined) {
        throw new Error("Collapse control was not rendered");
      }
      collapse.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, composed: true }),
      );
      collapse.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          composed: true,
          key: "Enter",
        }),
      );
      collapse.click();

      const targetAction = document.querySelector<HTMLButtonElement>(
        "#target-page-action",
      );
      targetAction?.click();
      const fixture = window as typeof window & {
        fixtureCapturedUiEvents: string[];
        fixtureObservedUiEvents: string[];
        fixtureTargetPageActionCount: number;
      };
      return {
        capturedEvents: fixture.fixtureCapturedUiEvents,
        bubbledEvents: fixture.fixtureObservedUiEvents,
        targetPageActionCount: fixture.fixtureTargetPageActionCount,
      };
    });

    expect(observed).toEqual({
      capturedEvents: ["pointerdown", "keydown", "click", "click"],
      bubbledEvents: ["click"],
      targetPageActionCount: 1,
    });
  } finally {
    await page.close();
  }
});

test("Document Runtime excludes owned UI and hides diagnostics during capture", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(
      "http://127.0.0.1:4173/extension-ui-contamination/",
    );
    await triggerToolbarAction(page);
    await page.waitForSelector("[data-ui-torture-lab-root]");

    const probe = await exerciseMeasurementSafeRuntime();

    expect(probe.before).toMatchObject({
      diagnosticHighlightCount: 1,
      diagnosticHighlightsRendered: 1,
      overlayRendered: true,
      panelRendered: true,
      ownsOverlay: true,
      ownsPanel: true,
    });
    expect(probe.before.ownedRootCount).toBeGreaterThanOrEqual(4);
    expect(probe.during).toMatchObject({
      diagnosticHighlightCount: 1,
      diagnosticHighlightsRendered: 0,
      overlayRendered: false,
      panelRendered: false,
    });
    expect(probe.after).toEqual(probe.before);
  } finally {
    await page.close();
  }
});

test("floating UI loss and remount preserve one active Document Runtime without Restore", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/text-clipping-run/");
    await triggerToolbarAction(page);
    await page.waitForSelector("[data-ui-torture-lab-root]");

    const initialRuntimeId = await page.$eval(
      "[data-ui-torture-lab-root]",
      (host) => (host as HTMLElement).dataset.uiTortureLabRuntimeId,
    );
    await page.evaluate(() => {
      const host = document.querySelector("[data-ui-torture-lab-root]");
      const collapse = host?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[aria-label="Collapse UI Torture Lab"]',
      );
      collapse?.click();
    });
    await expect
      .poll(() =>
        page.$eval(
          "[data-ui-torture-lab-root]",
          (host) => (host as HTMLElement).dataset.uiTortureLabCollapsed,
        ),
      )
      .toBe("true");

    await triggerToolbarAction(page);
    await expect
      .poll(() =>
        page.$eval(
          "[data-ui-torture-lab-root]",
          (host) => (host as HTMLElement).dataset.uiTortureLabCollapsed,
        ),
      )
      .toBe("false");

    await page.evaluate(() => {
      const start = [...(
        document
          .querySelector("[data-ui-torture-lab-root]")
          ?.shadowRoot?.querySelectorAll("button") ?? []
      )].find((button) => button.textContent?.trim() === "Apply Long Text");
      if (!(start instanceof HTMLButtonElement)) {
        throw new Error("Long Text control was unavailable");
      }
      start.click();
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-ui-torture-lab-root]")
          ?.shadowRoot?.textContent?.includes("Long Text Scenario active") === true,
    );
    const mutatedTarget = await page.$eval(
      "#clipping-boundary",
      (element) => element.textContent,
    );

    const devTools = await page.target().createCDPSession();
    const { root } = await devTools.send("DOM.getDocument");
    for (const selector of [
      "[data-ui-torture-lab-root]",
      "[data-ui-torture-lab-overlay-root]",
    ]) {
      const { nodeId } = await devTools.send("DOM.querySelector", {
        nodeId: root.nodeId,
        selector,
      });
      await devTools.send("DOM.removeNode", { nodeId });
    }
    await triggerToolbarAction(page);
    await page.waitForSelector("[data-ui-torture-lab-root]");
    await expect
      .poll(() =>
        page.$eval(
          "[data-ui-torture-lab-root]",
          (host) => host.shadowRoot?.textContent?.includes("Long Text Scenario active"),
        ),
      )
      .toBe(true);

    await page.evaluate(() => {
      document.querySelector("[data-ui-torture-lab-root]")?.remove();
      document.querySelector("[data-ui-torture-lab-overlay-root]")?.remove();
    });
    await triggerToolbarAction(page);
    await page.waitForSelector("[data-ui-torture-lab-root]");

    const remounted = await page.evaluate(() => ({
      hostCount: document.querySelectorAll("[data-ui-torture-lab-root]").length,
      overlayCount: document.querySelectorAll(
        "[data-ui-torture-lab-overlay-root]",
      ).length,
      runtimeId: document.querySelector<HTMLElement>(
        "[data-ui-torture-lab-root]",
      )?.dataset.uiTortureLabRuntimeId,
    }));
    expect(remounted).toEqual({
      hostCount: 1,
      overlayCount: 1,
      runtimeId: initialRuntimeId,
    });
    expect(await page.$eval("#clipping-boundary", (element) => element.textContent)).toBe(
      mutatedTarget,
    );
  } finally {
    await page.close();
  }
});

test("toolbar marks an active Run while collapsed and clears after Restore", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/text-clipping-run/");
    await triggerToolbarAction(page);
    await page.waitForSelector("[data-ui-torture-lab-root]");

    await page.evaluate(() => {
      const root = document.querySelector("[data-ui-torture-lab-root]");
      const start = [...(root?.shadowRoot?.querySelectorAll("button") ?? [])].find(
        (button) => button.textContent?.trim() === "Apply Long Text",
      );
      if (!(start instanceof HTMLButtonElement)) {
        throw new Error("Long Text control was unavailable");
      }
      start.click();
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-ui-torture-lab-root]")
          ?.shadowRoot?.textContent?.includes("Long Text Scenario active") === true,
    );
    await page.evaluate(() => {
      document
        .querySelector("[data-ui-torture-lab-root]")
        ?.shadowRoot?.querySelector<HTMLButtonElement>(
          '[aria-label="Collapse UI Torture Lab"]',
        )
        ?.click();
    });

    await expect.poll(readActiveTabActionState).toEqual({
      badge: "RUN",
      title: "UI Torture Lab — Scenario active",
    });

    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await expect.poll(readActiveTabActionState).toEqual({
      badge: "",
      title: "Open UI Torture Lab",
    });

    await page.evaluate(() => {
      const root = document.querySelector("[data-ui-torture-lab-root]");
      root?.shadowRoot?.querySelector<HTMLButtonElement>(
        '[aria-label="Expand UI Torture Lab"]',
      )?.click();
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-ui-torture-lab-root]")
          ?.shadowRoot?.querySelector('[aria-label="Expand UI Torture Lab"]') === null,
    );
    await page.evaluate(() => {
      const restore = [...(
        document
          .querySelector("[data-ui-torture-lab-root]")
          ?.shadowRoot?.querySelectorAll("button") ?? []
      )].find((button) => button.textContent?.trim() === "Restore");
      if (!(restore instanceof HTMLButtonElement)) {
        throw new Error("Restore control was unavailable");
      }
      restore.click();
    });

    await expect.poll(readActiveTabActionState).toEqual({
      badge: "",
      title: "Open UI Torture Lab",
    });
  } finally {
    await page.close();
  }
});

test("a replacement Document creates a fresh runtime only after a new toolbar action", async () => {
  const page = await browser.newPage();
  try {
    const fixtureUrl =
      "http://127.0.0.1:4173/extension-ui-contamination/";
    await page.goto(fixtureUrl);
    await triggerToolbarAction(page);
    const previousRuntimeId = await page.$eval(
      "[data-ui-torture-lab-root]",
      (host) => (host as HTMLElement).dataset.uiTortureLabRuntimeId,
    );

    await page.reload();
    expect(await page.$$("[data-ui-torture-lab-root]")).toHaveLength(0);

    await triggerToolbarAction(page);
    await page.waitForSelector("[data-ui-torture-lab-root]");
    const nextRuntimeId = await page.$eval(
      "[data-ui-torture-lab-root]",
      (host) => (host as HTMLElement).dataset.uiTortureLabRuntimeId,
    );
    expect(nextRuntimeId).toBeTruthy();
    expect(nextRuntimeId).not.toBe(previousRuntimeId);
    expect(await page.$$("[data-ui-torture-lab-root]")).toHaveLength(1);
  } finally {
    await page.close();
  }
});

test("floating UI remains inside a small viewport without document overflow", async () => {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 320, height: 480 });
    await page.goto(
      "http://127.0.0.1:4173/extension-ui-contamination/",
    );
    const before = await readFixtureGeometry(page);
    await triggerToolbarAction(page);

    const surface = await page.$eval(
      "[data-ui-torture-lab-root]",
      (host) => {
        const panel = host.shadowRoot?.querySelector(".panel-shell");
        if (!(panel instanceof HTMLElement)) {
          throw new Error("Floating panel was not rendered");
        }
        const rect = panel.getBoundingClientRect();
        return {
          blockEnd: rect.bottom,
          blockStart: rect.top,
          inlineEnd: rect.right,
          inlineStart: rect.left,
        };
      },
    );

    expect(await readFixtureGeometry(page)).toEqual(before);
    expect(surface.inlineStart).toBeGreaterThanOrEqual(0);
    expect(surface.inlineEnd).toBeLessThanOrEqual(320);
    expect(surface.blockStart).toBeGreaterThanOrEqual(0);
    expect(surface.blockEnd).toBeLessThanOrEqual(480);
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
