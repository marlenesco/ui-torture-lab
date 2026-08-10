// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";
import path from "node:path";
import puppeteer, {
  type Browser,
  type Extension,
  type Page,
  type WebWorker,
} from "puppeteer-core";

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

test.describe.configure({ mode: "serial" });

let browser: Browser;
let extension: Extension;
let serviceWorker: WebWorker;

const triggerToolbarAction = async (page: Page): Promise<void> => {
  await page.bringToFront();
  await page.triggerExtensionAction(extension);
  await page.waitForSelector("[data-ui-torture-lab-root]");
};

const clickPanelButton = async (page: Page, label: string): Promise<void> => {
  await page.waitForFunction(
    (accessibleName) =>
      [...(
        document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
          ?.querySelectorAll("button") ?? []
      )].some((button) => button.textContent?.trim() === accessibleName),
    {},
    label,
  );
  await page.evaluate((accessibleName) => {
    const button = [...(
      document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
        ?.querySelectorAll("button") ?? []
    )].find((candidate) => candidate.textContent?.trim() === accessibleName);
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Panel button ${accessibleName} was unavailable`);
    }
    button.click();
  }, label);
};

const readPanelText = (page: Page): Promise<string> =>
  page.evaluate(
    () =>
      document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
        ?.textContent ?? "",
  );

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

  const serviceWorkerTarget = await browser.waitForTarget(
    (target) =>
      target.type() === "service_worker" && target.url().includes(extensionId),
  );
  const installedServiceWorker = await serviceWorkerTarget.worker();
  if (installedServiceWorker === null) {
    throw new Error("Built UI Torture Lab service worker was unavailable");
  }
  serviceWorker = installedServiceWorker;
});

test.afterAll(async () => {
  await browser.close();
});

test("Long Text remains active until exact Restore", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/long-text-run/");
    await triggerToolbarAction(page);

    const observation = await serviceWorker.evaluate(async () => {
      const chromeApi = (globalThis as unknown as { chrome: ChromeApi }).chrome;
      const [tab] = await chromeApi.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id === undefined) {
        throw new Error("No active fixture tab was available");
      }

      const [injection] = await chromeApi.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        world: "ISOLATED",
        func: async () => {
          type Snapshot = {
            readonly coverage: {
              readonly eligibleTargets: number;
              readonly mutatedTargets: number;
            };
            readonly phase: string;
            readonly result?: {
              readonly findings: readonly unknown[];
              readonly status: string;
            };
            readonly scenarioId?: string;
          };
          type Controller = {
            getSnapshot(): Snapshot;
            restore(): void;
            startScenario(scenarioId: "long-text"): Promise<void>;
          };
          const runtime = (globalThis as typeof globalThis & {
            [key: symbol]: { readonly runController?: Controller } | undefined;
          })[Symbol.for("ui-torture-lab/document-runtime")];
          if (runtime?.runController === undefined) {
            throw new Error("Run Controller was not available");
          }

          const target = document.querySelector("#primary-target")?.firstChild;
          if (!(target instanceof Text)) {
            throw new Error("Fixture Text node was unavailable");
          }
          const original = target.data;
          await runtime.runController.startScenario("long-text");
          const active = runtime.runController.getSnapshot();
          const expanded = target.data;
          const sameNodeWhileActive =
            document.querySelector("#primary-target")?.firstChild === target;

          runtime.runController.restore();
          const completed = runtime.runController.getSnapshot();
          return {
            active,
            completed,
            expanded,
            original,
            restored: target.data,
            sameNodeAfterRestore:
              document.querySelector("#primary-target")?.firstChild === target,
            sameNodeWhileActive,
          };
        },
      });
      if (injection?.result === undefined) {
        throw new Error("Long Text observation returned no result");
      }
      return injection.result;
    });

    expect(observation.original).toBe("  Checkout now!  ");
    expect(observation.expanded).toBe(
      "  Checkout now! Checkout now! Checkout now!  ",
    );
    expect(observation.sameNodeWhileActive).toBe(true);
    expect(observation.active).toMatchObject({
      phase: "ready-for-inspection",
      scenarioId: "long-text",
      coverage: { eligibleTargets: 7, mutatedTargets: 7 },
    });
    expect(observation.restored).toBe(observation.original);
    expect(observation.sameNodeAfterRestore).toBe(true);
    expect(observation.completed).toMatchObject({
      phase: "completed",
      scenarioId: "long-text",
      result: { status: "completed", findings: [] },
    });
  } finally {
    await page.close();
  }
});

test("Long Text preserves supported nodes and excludes unsupported targets", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/long-text-run/");
    await triggerToolbarAction(page);

    const observation = await serviceWorker.evaluate(async () => {
      const chromeApi = (globalThis as unknown as { chrome: ChromeApi }).chrome;
      const [tab] = await chromeApi.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id === undefined) {
        throw new Error("No active fixture tab was available");
      }

      const [injection] = await chromeApi.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        world: "ISOLATED",
        func: async () => {
          type Controller = {
            getSnapshot(): {
              readonly coverage: Record<string, number>;
              readonly result: unknown;
            };
            restore(): void;
            startScenario(scenarioId: "long-text"): Promise<void>;
          };
          const runtime = (globalThis as typeof globalThis & {
            [key: symbol]:
              | {
                  isExtensionOwnedNode(node: Node): boolean;
                  readonly runController?: Controller;
                }
              | undefined;
          })[Symbol.for("ui-torture-lab/document-runtime")];
          if (runtime?.runController === undefined) {
            throw new Error("Run Controller was not available");
          }

          const text = (selector: string): Text => {
            const node = document.querySelector(selector)?.firstChild;
            if (!(node instanceof Text)) {
              throw new Error(`Missing fixture Text for ${selector}`);
            }
            return node;
          };
          const primary = text("#primary-target");
          const inline = document.querySelector("#inline-target");
          const inlineNodes = inline === null ? [] : [...inline.childNodes];
          const emoji = text("#emoji-target");
          const minimum = text("#minimum-target");
          const excluded = [
            text("#hidden-target"),
            text("#editable-target"),
            text("#code-target"),
            text("#icon-target"),
            text("#structured-target"),
            text("#short-target"),
          ];
          const extensionOwnedProbe = text("#extension-owned-probe");
          const shadowText = document
            .querySelector("#shadow-host")
            ?.shadowRoot?.querySelector("#shadow-text")?.firstChild;
          const frameText = document
            .querySelector<HTMLIFrameElement>("#frame-target")
            ?.contentDocument?.querySelector("#frame-text")?.firstChild;
          if (
            shadowText?.nodeType !== Node.TEXT_NODE ||
            frameText?.nodeType !== Node.TEXT_NODE
          ) {
            throw new Error("Nested-scope fixture Text was unavailable");
          }
          const shadowTarget = shadowText as Text;
          const frameTarget = frameText as Text;

          const originals = new Map(
            [...excluded, extensionOwnedProbe, shadowTarget, frameTarget].map(
              (node) => [node, node.data] as const,
            ),
          );
          const originalEmoji = emoji.data;
          const originalMinimum = minimum.data;
          const originalPrimary = primary.data;
          const originalInlineHtml = inline?.innerHTML;
          const originalInlineText = inline?.textContent;

          // The real extension roots are already excluded. This probe exercises
          // the direct-reference ownership seam without adding DOM markers.
          const originalOwnership = runtime.isExtensionOwnedNode.bind(runtime);
          runtime.isExtensionOwnedNode = (node: Node) =>
            node === extensionOwnedProbe || originalOwnership(node);

          await runtime.runController.startScenario("long-text");
          const activeCoverage = runtime.runController.getSnapshot().coverage;
          const emojiExpanded = emoji.data;
          const minimumExpanded = minimum.data;
          const excludedWhileActive = [...originals].map(
            ([node, original]) => node.data === original,
          );
          const inlineIdentityPreserved =
            inline !== null &&
            inlineNodes.length === inline.childNodes.length &&
            inlineNodes.every((node, index) => node === inline.childNodes[index]);
          const inlineStructurePreserved =
            inline?.querySelector("strong")?.textContent ===
            "brave brave brave";

          let secondRunError = "";
          try {
            await runtime.runController.startScenario("long-text");
          } catch (error) {
            secondRunError =
              error instanceof Error ? error.message : "unknown error";
          }

          runtime.runController.restore();
          return {
            activeCoverage,
            completed: runtime.runController.getSnapshot(),
            emojiExpanded,
            excludedWhileActive,
            inlineIdentityPreserved,
            inlineStructurePreserved,
            minimumExpanded,
            originalEmoji,
            originalMinimum,
            originalInlineHtml,
            originalInlineText,
            restoredEmoji: emoji.data,
            restoredMinimum: minimum.data,
            restoredInlineHtml: inline?.innerHTML,
            restoredInlineText: inline?.textContent,
            restoredPrimary: primary.data,
            originalPrimary,
            secondRunError,
          };
        },
      });
      if (injection?.result === undefined) {
        throw new Error("Long Text eligibility observation returned no result");
      }
      return injection.result;
    });

    expect(observation.excludedWhileActive).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(observation.inlineIdentityPreserved).toBe(true);
    expect(observation.inlineStructurePreserved).toBe(true);
    expect(observation.emojiExpanded).toBe(
      "👩🏽‍💻 builds interfaces 👩🏽‍💻 builds interfaces 👩🏽‍💻 builds interfaces",
    );
    expect(observation.secondRunError).toBe("A Run is already active");
    expect(observation.activeCoverage).toEqual({
      excludedTargets: 0,
      eligibleTargets: 6,
      inconclusiveTargets: 0,
      ineffectiveTargets: 0,
      mutatedTargets: 6,
      skippedTargets: 0,
    });
    expect(observation.restoredPrimary).toBe(observation.originalPrimary);
    expect(observation.restoredEmoji).toBe(observation.originalEmoji);
    expect(observation.minimumExpanded).toBe("OK OK OK");
    expect(observation.restoredMinimum).toBe(observation.originalMinimum);
    expect(observation.restoredInlineHtml).toBe(observation.originalInlineHtml);
    expect(observation.restoredInlineText).toBe(observation.originalInlineText);
    expect(observation.completed).toMatchObject({
      phase: "completed",
      result: {
        coverage: {
          eligibleTargets: 6,
          inconclusiveTargets: 0,
          ineffectiveTargets: 0,
          mutatedTargets: 6,
          skippedTargets: 0,
        },
        findings: [],
        summary: expect.stringContaining("does not claim"),
      },
    });
    expect(() => JSON.stringify(observation.completed.result)).not.toThrow();
  } finally {
    await page.close();
  }
});

test("the built panel exposes Apply, active inspection, Restore, and result", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/long-text-run/");
    await triggerToolbarAction(page);
    const original = await page.$eval(
      "#primary-target",
      (target) => target.textContent,
    );

    await clickPanelButton(page, "Apply Long Text");
    await page.waitForFunction(
      () =>
        document.querySelector("#primary-target")?.textContent !==
        "  Checkout now!  ",
    );
    await page.waitForFunction(
      () =>
        [...(
          document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
            ?.querySelectorAll("button") ?? []
        )].some((button) => button.textContent?.trim() === "Restore"),
    );
    expect(await readPanelText(page)).toContain("Scenario active");
    expect(await readPanelText(page)).toContain("7 mutated");

    await clickPanelButton(page, "Restore");
    await page.waitForFunction(
      () =>
        document.querySelector("#primary-target")?.textContent ===
        "  Checkout now!  ",
    );
    const completedPanel = await readPanelText(page);
    expect(completedPanel).toContain("Run completed");
    expect(completedPanel).toContain("No supported Finding was produced");
    expect(completedPanel).toContain("7 eligible");
    expect(await page.$eval("#primary-target", (target) => target.textContent)).toBe(
      original,
    );
  } finally {
    await page.close();
  }
});

test("Restore conflict leaves external text untouched and blocks another Run", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/long-text-run/");
    await triggerToolbarAction(page);
    await clickPanelButton(page, "Apply Long Text");
    await page.waitForFunction(
      () => document.querySelector("#minimum-target")?.textContent === "OK OK OK",
    );
    await page.$eval("#primary-target", (target) => {
      target.textContent = "Developer-owned change";
    });

    await clickPanelButton(page, "Restore");
    await page.waitForFunction(
      () =>
        document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
          ?.textContent?.includes("Reload required") === true,
    );
    const panelText = await readPanelText(page);
    expect(panelText).toContain("Restore conflict");
    expect(panelText).toContain("External changes were left untouched");
    expect(panelText).not.toContain("Apply Long Text");
    expect(
      await page.$eval("#primary-target", (target) => target.textContent),
    ).toBe("Developer-owned change");
    expect(
      await page.$eval("#minimum-target", (target) => target.textContent),
    ).toBe("OK");

    const blockedMessage = await serviceWorker.evaluate(async () => {
      const chromeApi = (globalThis as unknown as { chrome: ChromeApi }).chrome;
      const [tab] = await chromeApi.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id === undefined) {
        throw new Error("No active fixture tab was available");
      }
      const [injection] = await chromeApi.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        world: "ISOLATED",
        func: async () => {
          type Controller = {
            startScenario(scenarioId: "long-text"): Promise<void>;
          };
          const runtime = (globalThis as typeof globalThis & {
            [key: symbol]: { readonly runController?: Controller } | undefined;
          })[Symbol.for("ui-torture-lab/document-runtime")];
          try {
            await runtime?.runController?.startScenario("long-text");
            return "not blocked";
          } catch (error) {
            return error instanceof Error ? error.message : "unknown";
          }
        },
      });
      return injection?.result;
    });
    expect(blockedMessage).toContain("requires reload");
  } finally {
    await page.close();
  }
});

test("an Engine safety abort is distinct from Restore conflict in the built UI", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/long-text-run/");
    await triggerToolbarAction(page);

    await serviceWorker.evaluate(async () => {
      const chromeApi = (globalThis as unknown as { chrome: ChromeApi }).chrome;
      const [tab] = await chromeApi.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id === undefined) {
        throw new Error("No active fixture tab was available");
      }
      await chromeApi.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        world: "ISOLATED",
        func: async () => {
          type Controller = {
            startScenario(scenarioId: "long-text"): Promise<void>;
          };
          const runtime = (globalThis as typeof globalThis & {
            [key: symbol]: { readonly runController?: Controller } | undefined;
          })[Symbol.for("ui-torture-lab/document-runtime")];
          const target = document.querySelector("#primary-target")?.firstChild;
          const descriptor = Object.getOwnPropertyDescriptor(
            CharacterData.prototype,
            "data",
          );
          if (
            runtime?.runController === undefined ||
            !(target instanceof Text) ||
            descriptor?.get === undefined ||
            descriptor.set === undefined
          ) {
            throw new Error("Safety-abort fixture was unavailable");
          }
          const nativeGet = descriptor.get;
          const nativeSet = descriptor.set;
          let writes = 0;
          Object.defineProperty(target, "data", {
            configurable: true,
            get() {
              return nativeGet.call(this) as string;
            },
            set(value: string) {
              writes += 1;
              nativeSet.call(this, value);
              if (writes === 1) {
                throw new Error("Synthetic unverified write");
              }
            },
          });
          await runtime.runController.startScenario("long-text");
        },
      });
    });

    await page.waitForFunction(
      () =>
        document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
          ?.textContent?.includes("Run aborted") === true,
    );
    const panelText = await readPanelText(page);
    expect(panelText).toContain("Run aborted");
    expect(panelText).toContain("Restore completed");
    expect(panelText).toContain("No Findings were produced");
    expect(panelText).not.toContain("Restore conflict");
  } finally {
    await page.close();
  }
});

test("an unverified cleanup is distinct from an external Restore conflict", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/long-text-run/");
    await triggerToolbarAction(page);
    await clickPanelButton(page, "Apply Long Text");
    await page.waitForFunction(
      () => document.querySelector("#minimum-target")?.textContent === "OK OK OK",
    );
    await page.waitForFunction(
      () =>
        document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
          ?.textContent?.includes("Scenario active") === true,
    );

    await serviceWorker.evaluate(async () => {
      const chromeApi = (globalThis as unknown as { chrome: ChromeApi }).chrome;
      const [tab] = await chromeApi.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id === undefined) {
        throw new Error("No active fixture tab was available");
      }
      await chromeApi.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        world: "ISOLATED",
        func: () => {
          type Controller = { restore(): void };
          const runtime = (globalThis as typeof globalThis & {
            [key: symbol]: { readonly runController?: Controller } | undefined;
          })[Symbol.for("ui-torture-lab/document-runtime")];
          const target = document.querySelector("#primary-target")?.firstChild;
          const descriptor = Object.getOwnPropertyDescriptor(
            CharacterData.prototype,
            "data",
          );
          if (
            runtime?.runController === undefined ||
            !(target instanceof Text) ||
            descriptor?.get === undefined ||
            descriptor.set === undefined
          ) {
            throw new Error("Restore-exception fixture was unavailable");
          }
          const nativeGet = descriptor.get;
          Object.defineProperty(target, "data", {
            configurable: true,
            get() {
              return nativeGet.call(this) as string;
            },
            set() {
              throw new Error("Synthetic Restore exception");
            },
          });
          runtime.runController.restore();
        },
      });
    });

    await page.waitForFunction(
      () =>
        document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
          ?.textContent?.includes("Restore unverified") === true,
    );
    const panelText = await readPanelText(page);
    expect(panelText).toContain("Reload required");
    expect(panelText).toContain("Restore unverified");
    expect(panelText).not.toContain("Restore conflict");
  } finally {
    await page.close();
  }
});
