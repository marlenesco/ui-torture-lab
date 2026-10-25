// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";
import { waitForExtensionPanel } from "../support/extension-panel";
import path from "node:path";
import puppeteer, { type Browser, type Extension, type Page, type WebWorker } from "puppeteer-core";


test.describe.configure({ mode: "serial" });
let browser: Browser;
let extension: Extension;
let worker: WebWorker;

test.beforeAll(async () => {
  browser = await puppeteer.launch({ executablePath: await puppeteer.executablePath("chrome"), headless: true, enableExtensions: true });
  const id = await browser.installExtension(path.resolve("apps/extension/.output/chrome-mv3"));
  const installed = (await browser.extensions()).get(id);
  if (installed === undefined) throw new Error("Built extension unavailable");
  extension = installed;
  const target = await browser.waitForTarget((candidate) => candidate.type() === "service_worker" && candidate.url().includes(id));
  const serviceWorker = await target.worker();
  if (serviceWorker === null) throw new Error("Extension worker unavailable");
  worker = serviceWorker;
});
test.afterAll(async () => { await browser?.close(); });

async function isolated<T>(func: () => T | Promise<T>): Promise<T> {
  return worker.evaluate(`(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) throw new Error("Fixture tab unavailable");
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] }, world: "ISOLATED", func: ${func.toString()}
    });
    if (injection === undefined) throw new Error("ISOLATED probe unavailable");
    return injection.result;
  })()`) as Promise<T>;
}

async function open(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:4173/same-document-navigation/");
  await page.bringToFront();
  await page.triggerExtensionAction(extension);
  await waitForExtensionPanel(page);
}

const panelText = (page: Page): Promise<string> => page.$eval("[data-ui-torture-lab-root]", (host) => host.shadowRoot?.textContent ?? "");
const clickPanel = (page: Page, name: string): Promise<void> => page.locator(`::-p-aria(${name})`).setTimeout(5000).click();
const report = (page: Page): Promise<string> => page.$eval('[data-ui-torture-lab-root] >>> textarea[aria-label="Markdown preview"]', (element) => (element as HTMLTextAreaElement).value);
const storedLifecycle = (): Promise<string | null> => worker.evaluate(async () => {
  const api = (globalThis as unknown as { chrome: {
    storage: { session: { get(key: null): Promise<Record<string, unknown>> } };
    tabs: { query(query: object): Promise<{ id?: number }[]> };
  } }).chrome;
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  const stored = await api.storage.session.get(null);
  const session = stored[`ui-torture-lab:tab-session:${tab?.id}`] as { id?: string } | undefined;
  const result = stored[`ui-torture-lab:current-run-result:${session?.id}`] as { state?: string } | undefined;
  return result?.state ?? null;
});

test("Chrome ISOLATED world observes committed History, fragment, traversal and router entry changes", async () => {
  const page = await browser.newPage();
  try {
    await open(page);
    expect(await isolated(() => (globalThis as unknown as { [key: symbol]: unknown })[Symbol.for("ui-torture-lab/page-authorization-attempt")] === undefined)).toBe(true);
    // This probe observes platform events; application code remains in its normal fixture world.
    await isolated(() => {
      const scope = globalThis as unknown as { navigation: Navigation; navigationProbe?: string[] };
      scope.navigationProbe = [];
      scope.navigation.addEventListener("currententrychange", () => scope.navigationProbe?.push("committed"));
      return scope.navigation.currentEntry !== null;
    });
    const count = () => isolated(() => (globalThis as unknown as { navigationProbe: string[] }).navigationProbe.length);
    for (const [selector, expected] of [["#push", 1], ["#replace", 2], ["#state", 3], ["#fragment", 4], ["#router", 5]] as const) {
      await page.$eval(selector, (element) => (element as HTMLElement).click());
      await expect.poll(count).toBe(expected);
    }
    await page.goBack();
    await expect.poll(count).toBe(6);
    await page.goForward();
    await expect.poll(count).toBe(7);
    await page.evaluate(() => window.navigation!.updateCurrentEntry({ state: { fixture: true } }));
    await expect.poll(count).toBe(8);
    await page.evaluate(async () => { await window.navigation!.navigate("#api").finished; });
    await expect.poll(count).toBe(9);
    await page.evaluate(() => {
      window.navigation!.addEventListener("navigate", (event) => { event.preventDefault(); }, { once: true });
      const result = window.navigation!.navigate("#cancelled");
      void result.finished?.catch(() => undefined);
      void result.committed?.catch(() => undefined);
    });
    expect(await count()).toBe(9);
    await page.frames()[1]?.evaluate(() => { history.pushState({}, "", "#child"); });
    expect(await count()).toBe(9);
  } finally { await page.close(); }
});

test("an intercepted Navigation API router runs after the old context has restored its owned text", async () => {
  const page = await browser.newPage();
  try {
    await open(page);
    await clickPanel(page, "Apply Long Text");
    await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
    const beforeRouter = await page.evaluate(async () => {
      let before = "";
      window.navigation!.addEventListener("navigate", (event) => {
        event.intercept({ async handler() {
          const target = document.querySelector("#boundary");
          before = target?.textContent ?? "";
          if (target !== null) target.textContent = "Navigation router-owned content";
        } });
      }, { once: true });
      await window.navigation!.navigate("?route=navigation-router").finished;
      return before;
    });
    expect(beforeRouter).toBe("Checkout");
    await expect.poll(() => panelText(page)).toContain("Target Page authorization ended");
    expect(await page.$eval("#boundary", (element) => element.textContent)).toBe("Navigation router-owned content");
    expect(await report(page)).not.toContain("Navigation router-owned content");
  } finally { await page.close(); }
});

test("cancelled navigation, child-frame traversal and stable-route DOM updates do not end an Active Run", async () => {
  const page = await browser.newPage();
  try {
    await open(page);
    await clickPanel(page, "Apply Long Text");
    await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
    const mutated = await page.$eval("#boundary", (element) => element.textContent);
    await page.evaluate(async () => {
      window.navigation!.addEventListener("navigate", (event) => event.preventDefault(), { once: true });
      const result = window.navigation!.navigate("#cancelled");
      await Promise.allSettled([result.committed, result.finished]);
      document.body.dataset.fixtureUpdate = "stable-route";
    });
    await page.frames()[1]?.evaluate(() => { history.pushState({}, "", "#child"); });
    expect(await page.$eval("#boundary", (element) => element.textContent)).toBe(mutated);
    expect(await panelText(page)).toContain("Long Text Scenario active");
    await clickPanel(page, "Restore");
    expect(await page.$eval("#boundary", (element) => element.textContent)).toBe("Checkout");
  } finally { await page.close(); }
});

for (const selector of ["#push", "#replace", "#state", "#fragment", "#router"] as const) {
  test(`${selector} ends the active Run, preserves completed Evidence and requires a new toolbar action`, async () => {
    const page = await browser.newPage();
    try {
      await open(page);
      await clickPanel(page, "Apply Long Text");
      await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
      await page.$eval(selector, (element) => (element as HTMLElement).click());
      await expect.poll(() => panelText(page)).toContain("Target Page authorization ended");
      expect(await page.$eval("#boundary", (element) => element.textContent)).toBe(selector === "#router" ? "Router-owned content" : "Checkout");
      expect(await page.$eval("#later-target", (element) => element.textContent)).toBe("Continue");
      const text = await panelText(page);
      expect(text).toContain("Previous Target Snapshot");
      expect(text).not.toContain("Apply Long Text");
      expect(text).not.toContain("Highlight subject");
      expect(text).not.toContain("Navigate");
      const markdown = await report(page);
      expect(markdown).toContain("Lifecycle: Previous-Target Snapshot");
      expect(markdown).toContain("Termination reason: same\\-document\\-navigation");
      expect(markdown).toContain("Restore status: restored");
      expect(markdown).toContain("Page path: /same\\-document\\-navigation/");
      expect(markdown).not.toContain("Router-owned content");
      await expect.poll(storedLifecycle).toBe("previous");
      await page.triggerExtensionAction(extension);
      await expect.poll(() => panelText(page)).toContain("Apply Long Text");
      expect(await page.$eval("#boundary", (element) => element.textContent)).toBe(selector === "#router" ? "Router-owned content" : "Checkout");
      await clickPanel(page, "Apply Long Text");
      await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
      await clickPanel(page, "Restore");
    } finally { await page.close(); }
  });
}

test("an idle route transition revokes authorization without inventing a Run", async () => {
  const page = await browser.newPage();
  try {
    await open(page);
    await page.$eval("#state", (element) => (element as HTMLElement).click());
    await expect.poll(() => panelText(page)).toContain("Target Page authorization ended");
    expect(await panelText(page)).not.toContain("Previous Target Snapshot");
    expect(await panelText(page)).not.toContain("Apply Long Text");
  } finally { await page.close(); }
});

test("a route transition with a Restore conflict blocks same-Document toolbar reauthorization", async () => {
  const page = await browser.newPage();
  try {
    await open(page);
    await clickPanel(page, "Apply Long Text");
    await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
    await page.$eval("#boundary", (element) => { element.textContent = "External text"; });
    await page.$eval("#push", (element) => (element as HTMLElement).click());
    await expect.poll(() => panelText(page)).toContain("Reload required");
    expect(await report(page)).toContain("Restore status: conflict");
    await page.triggerExtensionAction(extension);
    await expect.poll(() => panelText(page)).toContain("Reload required");
    expect(await panelText(page)).not.toContain("Apply Long Text");
    expect(await page.$eval("#boundary", (element) => element.textContent)).toBe("External text");
    await page.reload();
    await page.triggerExtensionAction(extension);
    await expect.poll(() => panelText(page)).toContain("Apply Long Text");
  } finally { await page.close(); }
});

const activeBadge = (): Promise<string> => worker.evaluate(async () => {
  const api = (globalThis as unknown as { chrome: {
    tabs: { query(query: object): Promise<{ id: number }[]> };
    action: { getBadgeText(details: { tabId: number }): Promise<string> };
  } }).chrome;
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (tab === undefined) throw new Error("Fixture tab unavailable");
  return api.action.getBadgeText({ tabId: tab.id });
});

for (const transition of ["push", "state"] as const) {
  test(`a ${transition} commit during pending toolbar reauthorization cannot grant the subsequent context`, async () => {
    const page = await browser.newPage();
    try {
      await open(page);
      await clickPanel(page, "Apply Long Text");
      await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
      await page.$eval("#push", (element) => (element as HTMLElement).click());
      await expect.poll(() => panelText(page)).toContain("Target Page authorization ended");
      await isolated(() => {
        const scope = globalThis as unknown as { releaseSnapshotAck?: () => void; chrome: { runtime: { sendMessage(message: { type: string }): Promise<unknown> } } };
        const runtime = scope.chrome.runtime;
        const send = runtime.sendMessage.bind(runtime);
        runtime.sendMessage = (message) => message.type === "store-previous-run-result"
          ? send(message).then((saved) => new Promise((resolve) => {
            scope.releaseSnapshotAck = () => { runtime.sendMessage = send; resolve(saved); };
          })) : send(message);
        return true;
      });
      const action = page.triggerExtensionAction(extension);
      await expect.poll(() => isolated(() => typeof (globalThis as unknown as { releaseSnapshotAck?: unknown }).releaseSnapshotAck)).toBe("function");
      await page.$eval(`#${transition}`, (element) => (element as HTMLElement).click());
      await isolated(() => { (globalThis as unknown as { releaseSnapshotAck(): void }).releaseSnapshotAck(); return true; });
      await action;
      await expect.poll(activeBadge).toBe("!");
      expect(await panelText(page)).not.toContain("Apply Long Text");
      expect(await page.$eval("#boundary", (element) => element.textContent)).toBe("Checkout");
      await page.triggerExtensionAction(extension);
      await expect.poll(() => panelText(page)).toContain("Apply Long Text");
    } finally { await page.close(); }
  });
}

for (const stage of [1, 2, 3]) {
  test(`same-URL navigation between toolbar injections ${stage} and ${stage + 1} rejects the pending grant`, async () => {
    const page = await browser.newPage();
    try {
      await page.goto("http://127.0.0.1:4173/same-document-navigation/");
      await page.bringToFront();
      await worker.evaluate(`(() => {
        const original = chrome.scripting.executeScript.bind(chrome.scripting);
        let count = 0;
        globalThis.restoreInjectionProbe = () => { chrome.scripting.executeScript = original; };
        chrome.scripting.executeScript = async (details) => {
          const result = await original(details);
          if (++count === ${stage}) {
            await original({target: details.target, world: "ISOLATED", func: () => document.querySelector("#state").click()});
          }
          return result;
        };
      })()`);
      await page.triggerExtensionAction(extension);
      await expect.poll(activeBadge).toBe("!");
      const text = await page.evaluate(() => document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.textContent ?? "");
      expect(text).not.toContain("Apply Long Text");
    } finally {
      await worker.evaluate("globalThis.restoreInjectionProbe?.()");
      await page.close();
    }
  });
}
