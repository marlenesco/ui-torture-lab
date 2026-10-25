// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";
import { attachAuthorizationTrace, triggerFixtureAction } from "../support/extension-action";
import path from "node:path";
import puppeteer, { type Browser, type Extension, type Page, type WebWorker } from "puppeteer-core";
import { executeAsyncInIsolated } from "../support/extension-script";

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

const panelText = (page: Page): Promise<string> => page.evaluate(() => document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.textContent ?? "");
const clickPanel = (page: Page, name: string): Promise<void> => page.locator(`::-p-aria(${name})`).setTimeout(5000).click();

async function open(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:4173/page-exit/");
  await page.bringToFront();
  await triggerFixtureAction(page, extension);
  try { await expect.poll(() => panelText(page)).toContain("Apply Long Text"); }
  catch (error) { await attachAuthorizationTrace(page); throw error; }
}

test("pagehide restores synchronously without waiting for messaging or UI", async () => {
  const page = await browser.newPage();
  try {
    await open(page);
    await clickPanel(page, "Apply Long Text");
    await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
    await page.evaluate(() => {
      document.querySelector("[data-ui-torture-lab-root]")?.remove();
      document.querySelector("[data-ui-torture-lab-overlay-root]")?.remove();
    });
    const result = await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      return { text: document.querySelector("#boundary")?.textContent, later: document.querySelector("#later-target")?.textContent };
    });
    expect(result).toEqual({ text: "Checkout", later: "Continue" });
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    expect(await page.$eval("#boundary", (element) => element.textContent)).toBe("Checkout");
    await triggerFixtureAction(page, extension);
    await expect.poll(() => panelText(page)).toContain("Apply Long Text");
    expect(await panelText(page)).toContain("Previous Target Snapshot");
  } finally { await page.close(); }
});

test("successful BFCache restoration preserves cleaned DOM and never resumes the former grant", async () => {
  const page = await browser.newPage();
  try {
    await open(page);
    await clickPanel(page, "Apply Long Text");
    await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
    const runtimeId = await page.$eval("[data-ui-torture-lab-root]", (element) => (element as HTMLElement).dataset.uiTortureLabRuntimeId);
    await page.goto("http://127.0.0.1:4173/smoke/");
    await page.goBack();
    const state = await page.evaluate(() => ({
      lifecycle: (window as typeof window & { fixtureLifecycle: { restored: boolean } }).fixtureLifecycle,
      text: document.querySelector("#boundary")?.textContent,
      runtimeId: document.querySelector<HTMLElement>("[data-ui-torture-lab-root]")?.dataset.uiTortureLabRuntimeId,
    }));
    expect(state.lifecycle.restored).toBe(true);
    expect(state.runtimeId).toBe(runtimeId);
    expect(state.text).toBe("Checkout");
    await expect.poll(() => panelText(page)).toContain("Target Page authorization ended");
    expect(await panelText(page)).not.toContain("Apply Long Text");
    expect(await panelText(page)).not.toContain("Highlight subject");
    await triggerFixtureAction(page, extension);
    await expect.poll(() => panelText(page)).toContain("Apply Long Text");
    expect(await page.$eval("#boundary", (element) => element.textContent)).toBe("Checkout");
    await page.goForward();
    expect(page.url()).toContain("/smoke/");
  } finally { await page.close(); }
});

test("reload retains only a Previous-Target Snapshot after an active Run", async () => {
  const page = await browser.newPage();
  try {
    await open(page);
    await clickPanel(page, "Apply Long Text");
    await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
    await page.reload();
    expect(await page.$$("[data-ui-torture-lab-root]")).toHaveLength(0);
    await triggerFixtureAction(page, extension);
    await expect.poll(() => panelText(page)).toContain("Apply Long Text");
    expect(await panelText(page)).toContain("Previous Target Snapshot");
    expect(await page.$eval("#boundary", (element) => element.textContent)).toBe("Checkout");
  } finally { await page.close(); }
});

test("transport disconnection clears the Run indicator without ending an otherwise live Run", async () => {
  const page = await browser.newPage();
  try {
    await worker.evaluate(() => {
      const api = (globalThis as unknown as { chrome: { runtime: { onConnect: { addListener(callback: (port: { disconnect(): void; name: string }) => void): void } } } }).chrome;
      api.runtime.onConnect.addListener((port) => {
        if (port.name === "ui-torture-lab/document-reachability") (globalThis as unknown as { fixturePort: unknown }).fixturePort = port;
      });
    });
    await open(page);
    await clickPanel(page, "Apply Long Text");
    await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
    const mutated = await page.$eval("#boundary", (element) => element.textContent);
    await worker.evaluate(() => (globalThis as unknown as { fixturePort: { disconnect(): void } }).fixturePort.disconnect());
    await expect.poll(() => panelText(page)).toContain("Extension connection lost");
    expect(await page.$eval("#boundary", (element) => element.textContent)).toBe(mutated);
    expect(await panelText(page)).toContain("Long Text Scenario active");
    const badge = await worker.evaluate(async () => {
      const api = (globalThis as unknown as { chrome: { tabs: { query(query: object): Promise<{ id: number }[]> }; action: { getBadgeText(details: { tabId: number }): Promise<string> } } }).chrome;
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      if (tab === undefined) throw new Error("Fixture tab unavailable");
      return api.action.getBadgeText({ tabId: tab.id });
    });
    expect(badge).toBe("");
    await clickPanel(page, "Restore");
    expect(await page.$eval("#boundary", (element) => element.textContent)).toBe("Checkout");
  } finally { await page.close(); }
});

test("pagehide cleanup completes while extension messaging never acknowledges", async () => {
  const page = await browser.newPage();
  try {
    await open(page);
    await clickPanel(page, "Apply Long Text");
    await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
    await executeAsyncInIsolated(worker, async () => {
      const api = (globalThis as unknown as { chrome: { runtime: { sendMessage(message: unknown): Promise<unknown> } } }).chrome;
      api.runtime.sendMessage = () => new Promise(() => undefined);
      return true;
    });
    expect(await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
      return document.querySelector("#boundary")?.textContent;
    })).toBe("Checkout");
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await expect.poll(() => panelText(page)).toContain("Target Page authorization ended");
    expect(await panelText(page)).not.toContain("Apply Long Text");
  } finally { await page.close(); }
});

test("a pagehide Restore conflict stays reload-required after a BFCache-like restoration", async () => {
  const page = await browser.newPage();
  try {
    await open(page);
    await clickPanel(page, "Apply Long Text");
    await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
    expect(await page.evaluate(() => {
      const target = document.querySelector("#boundary");
      if (target === null) throw new Error("Fixture unavailable");
      target.textContent = "External text";
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      return { text: target.textContent, later: document.querySelector("#later-target")?.textContent };
    })).toEqual({ text: "External text", later: "Continue" });
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await expect.poll(() => panelText(page)).toContain("Reload required");
    await triggerFixtureAction(page, extension);
    expect(await panelText(page)).not.toContain("Apply Long Text");
    expect(await panelText(page)).toContain("Restore conflict");
    await page.reload();
    await triggerFixtureAction(page, extension);
    await expect.poll(() => panelText(page)).toContain("Apply Long Text");
  } finally { await page.close(); }
});

test("back navigation after unavailable BFCache creates a fresh unauthorized Document", async () => {
  const isolatedBrowser = await puppeteer.launch({
    executablePath: await puppeteer.executablePath("chrome"), headless: true,
    enableExtensions: true, args: ["--disable-features=BackForwardCache"],
  });
  try {
    const id = await isolatedBrowser.installExtension(path.resolve("apps/extension/.output/chrome-mv3"));
    const installed = (await isolatedBrowser.extensions()).get(id);
    if (installed === undefined) throw new Error("Built extension unavailable");
    const target = await isolatedBrowser.waitForTarget((candidate) => candidate.type() === "service_worker" && candidate.url().includes(id));
    const isolatedWorker = await target.worker();
    if (isolatedWorker === null) throw new Error("Extension worker unavailable");
    const page = await isolatedBrowser.newPage();
    await page.goto("http://127.0.0.1:4173/page-exit/");
    await page.bringToFront();
    await page.triggerExtensionAction(installed);
    await expect.poll(() => panelText(page)).toContain("Apply Long Text");
    await clickPanel(page, "Apply Long Text");
    await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
    await page.goto("http://127.0.0.1:4173/smoke/");
    await page.goBack();
    expect(await page.evaluate(() => (window as typeof window & { fixtureLifecycle: { restored: boolean } }).fixtureLifecycle.restored)).toBe(false);
    expect(await page.$$("[data-ui-torture-lab-root]")).toHaveLength(0);
    expect(await page.$eval("#boundary", (element) => element.textContent)).toBe("Checkout");
    await page.triggerExtensionAction(installed);
    await expect.poll(() => panelText(page)).toContain("Apply Long Text");
    await expect.poll(() => panelText(page)).toContain("Previous Target Snapshot");
  } finally { await isolatedBrowser.close(); }
});

for (const scenario of ["Long Text", "Unbreakable Text", "Large Text"] as const) {
  test(`Page Exit cancels pending ${scenario} work and ignores its late frame after restoration`, async () => {
    const page = await browser.newPage();
    try {
      await open(page);
      await executeAsyncInIsolated(worker, async () => {
        const scope = globalThis as typeof globalThis & { fixtureLateFrame?: FrameRequestCallback };
        const nativeFrame = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (callback) => nativeFrame(() => { scope.fixtureLateFrame = callback; });
        return true;
      });
      await clickPanel(page, `Apply ${scenario}`);
      await expect.poll(() => panelText(page)).toContain(`Applying ${scenario}`);
      const immediate = await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
        return document.querySelector("#boundary")?.textContent;
      });
      expect(immediate).toBe("Checkout");
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
      await executeAsyncInIsolated(worker, async () => {
        (globalThis as typeof globalThis & { fixtureLateFrame?: FrameRequestCallback }).fixtureLateFrame?.(performance.now());
        return true;
      });
      await expect.poll(() => panelText(page)).toContain("Target Page authorization ended");
      expect(await panelText(page)).not.toContain("Apply Long Text");
      expect(await page.$eval("#boundary", (element) => element.textContent)).toBe("Checkout");
      expect(await page.$eval("#boundary", (element) => (element as HTMLElement).style.fontSize)).toBe("");
      const markdown = await page.evaluate(() => document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.querySelector<HTMLTextAreaElement>('[aria-label="Markdown preview"]')?.value);
      expect(markdown).toContain("Run status: aborted");
      expect(markdown).toContain("Termination reason: page\\-exit");
    } finally { await page.close(); }
  });
}
