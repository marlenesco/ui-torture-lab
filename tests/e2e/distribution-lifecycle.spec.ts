// SPDX-License-Identifier: Apache-2.0

import { observeMarkdownDownloads } from "../support/markdown-download";
import { expect, test } from "@playwright/test";
import { triggerFixtureAction } from "../support/extension-action";
import path from "node:path";
import puppeteer, { type Browser, type Extension, type Page, type WebWorker } from "puppeteer-core";

test.describe.configure({ mode: "serial" });
let browser: Browser;
let extension: Extension;
let worker: WebWorker;
let extensionId: string;
const panelText = (page: Page): Promise<string> => page.evaluate(() =>
  document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.textContent ?? "");
const preview = (page: Page): Promise<string> => page.evaluate(() =>
  document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.querySelector<HTMLTextAreaElement>("textarea")?.value ?? "");
const click = (page: Page, name: string): Promise<void> => page.locator(`::-p-aria(${name})`).setTimeout(5000).click();
const geometry = (page: Page) => page.evaluate(() => ({
  width: innerWidth, height: innerHeight, client: document.documentElement.clientWidth,
  extent: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
}));

async function connectWorker(): Promise<void> {
  const target = await browser.waitForTarget((candidate) => candidate.type() === "service_worker" && candidate.url().includes(extensionId));
  const current = await target.worker();
  if (current === null) throw new Error("Built extension worker unavailable");
  worker = current;
}

test.beforeAll(async () => {
  browser = await puppeteer.launch({ executablePath: await puppeteer.executablePath("chrome"), headless: true, enableExtensions: true });
  extensionId = await browser.installExtension(path.resolve("apps/extension/.output/chrome-mv3"));
  const installed = (await browser.extensions()).get(extensionId);
  if (installed === undefined) throw new Error("Built extension unavailable");
  extension = installed;
  await connectWorker();
});
test.afterAll(async () => { await browser?.close(); });

async function stored(): Promise<Record<string, unknown>> {
  return worker.evaluate(() => (globalThis as unknown as {
    chrome: { storage: { session: { get(key: null): Promise<Record<string, unknown>> } } };
  }).chrome.storage.session.get(null));
}

for (const scenario of ["Long Text", "Unbreakable Text", "Large Text"] as const) {
  test(`public ${scenario} workflow retains comparable Evidence without UI or network contamination`, async () => {
    const page = await browser.newPage();
    const requests: string[] = [];
    const errors: string[] = [];
    try {
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto("http://127.0.0.1:4173/scenario-detector-matrix/?private=DO_NOT_RETAIN#PRIVATE_FRAGMENT");
      await page.bringToFront();
      const fullText = "Synthetic private paragraph for the retention boundary. ".repeat(16);
      await page.evaluate((text) => {
        const paragraph = document.createElement("p");
        paragraph.textContent = text;
        const input = document.createElement("input");
        input.type = "hidden";
        input.value = "PRIVATE_FORM_VALUE";
        document.querySelector("main")?.append(paragraph, input);
      }, fullText);
      const original = await page.$eval("main", (element) => element.innerHTML);
      const baselineGeometry = await geometry(page);
      const network = await page.target().createCDPSession();
      const workerTarget = browser.targets().find((target) => target.type() === "service_worker" && target.url().includes(extensionId));
      if (workerTarget === undefined) throw new Error("Worker target unavailable");
      const workerNetwork = await workerTarget.createCDPSession();
      for (const session of [network, workerNetwork]) {
        await session.send("Network.enable");
        session.on("Network.requestWillBeSent", (event) => requests.push(event.request.url));
      }
      await triggerFixtureAction(page, extension);
      await expect.poll(() => panelText(page)).toContain(`Apply ${scenario}`);
      expect(await geometry(page)).toEqual(baselineGeometry);
      await click(page, `Apply ${scenario}`);
      await expect.poll(() => panelText(page)).toContain(`${scenario} Scenario active`);
      for (const detector of ["Text Clipping", "Horizontal Containment Overflow", "Viewport Overflow"]) {
        expect(await panelText(page)).toContain(detector);
      }
      const mutatedGeometry = await geometry(page);
      for (const name of ["Highlight Finding Subject div#clipping", "Highlight affected ranges for div#clipping"]) {
        await click(page, name);
        expect(await geometry(page)).toEqual(mutatedGeometry);
      }
      await click(page, "Collapse UI Torture Lab");
      expect(await geometry(page)).toEqual(mutatedGeometry);
      await page.evaluate(() => {
        document.querySelector("[data-ui-torture-lab-root]")?.remove();
        document.querySelector("[data-ui-torture-lab-overlay-root]")?.remove();
      });
      expect(await geometry(page)).toEqual(mutatedGeometry);
      await triggerFixtureAction(page, extension);
      await expect.poll(() => panelText(page)).toContain(`${scenario} Scenario active`);
      expect(await geometry(page)).toEqual(mutatedGeometry);
      await click(page, "Restore");
      await expect.poll(() => preview(page)).toContain("Lifecycle: Current Run Result");
      const markdown = await preview(page);
      expect(markdown).toContain(`Scenario: ${scenario}`);
      for (const detector of ["Text Clipping", "Horizontal Containment Overflow", "Viewport Overflow"]) {
        expect(markdown).toContain(`### ${detector}`);
      }
      expect(markdown).toContain("Restore status: restored");
      expect(markdown).not.toContain("DO_NOT_RETAIN");
      expect(markdown).not.toContain("PRIVATE_FRAGMENT");
      expect(markdown).not.toContain(fullText);
      expect(markdown).not.toContain("PRIVATE_FORM_VALUE");
      expect(await page.$eval("main", (element) => element.innerHTML)).toBe(original);
      expect(await geometry(page)).toEqual(baselineGeometry);
      const downloads = await observeMarkdownDownloads(browser);
      try {
        const file = await downloads.capture(() => click(page, "Download Report"));
        expect(file.filename).toBe("ui-torture-lab-report.md");
        expect(file.bytes).toEqual(Buffer.from(markdown, "utf8"));
      } finally { await downloads.dispose(); }
      await expect.poll(() => panelText(page)).toContain("Markdown download requested.");
      expect(await preview(page)).toBe(markdown);
      expect(await panelText(page)).not.toContain("Highlight subject");
      await expect.poll(async () => Object.keys(await stored()).filter((key) => key.includes("current-run-result:")).length).toBe(1);
      const data = JSON.stringify(await stored());
      expect(data).not.toContain("DO_NOT_RETAIN");
      expect(data).not.toContain("PRIVATE_FRAGMENT");
      expect(data).not.toContain(fullText);
      expect(data).not.toContain("PRIVATE_FORM_VALUE");
      expect(requests.filter(url => !url.startsWith("blob:"))).toEqual([]);
      expect(errors).toEqual([]);
      await network.detach();
      await workerNetwork.detach();
    } finally { await page.close(); }
    await expect.poll(async () => Object.keys(await stored()).filter((key) => /tab-session:|current-run-result:/u.test(key))).toEqual([]);
  });
}

test("worker suspension loses transport but preserves local Restore and reconnects only on toolbar action", async () => {
  let page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/page-exit/");
    await page.bringToFront();
    await triggerFixtureAction(page, extension);
    await expect.poll(() => panelText(page)).toContain("Apply Long Text");
    await click(page, "Apply Long Text");
    await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
    const mutated = await page.$eval("#boundary", (element) => element.textContent);
    const endpoint = browser.wsEndpoint();
    await worker.evaluate(() => { (globalThis as unknown as { fixtureWorkerMarker: string }).fixtureWorkerMarker = "before-suspension"; });
    // Close natively and release debugger ownership; Target identity is not a worker-heap lifetime.
    await worker.close();
    await expect.poll(() => panelText(page)).toContain("Extension connection lost");
    expect(await page.$eval("#boundary", (element) => element.textContent)).toBe(mutated);
    await click(page, "Restore");
    expect(await page.$eval("#boundary", (element) => element.textContent)).toBe("Checkout");
    await expect.poll(() => preview(page)).toContain("Restore status: restored");
    expect(await page.evaluate(() => [...(document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.querySelectorAll<HTMLButtonElement>("button") ?? [])].filter(button => button.textContent?.startsWith("Apply ")).map(button => button.disabled))).toEqual([true, true, true]);
    // A fresh driver connection must observe the restarted heap, even if Chrome retains a Target identity.
    await browser.disconnect();
    browser = await puppeteer.connect({ browserWSEndpoint: endpoint, defaultViewport: null });
    const resumed = (await browser.pages()).find((candidate) => candidate.url() === "http://127.0.0.1:4173/page-exit/");
    if (resumed === undefined) throw new Error("Live fixture tab was lost during worker suspension");
    page = resumed;
    const installed = (await browser.extensions()).get(extensionId);
    if (installed === undefined) throw new Error("Installed extension was lost during driver reconnection");
    extension = installed;
    await connectWorker();
    expect(await worker.evaluate(() => (globalThis as unknown as { fixtureWorkerMarker?: string }).fixtureWorkerMarker)).toBeUndefined();
    await triggerFixtureAction(page, extension);
    await expect.poll(() => panelText(page)).toContain("Run completed");
    await expect.poll(() => panelText(page)).not.toContain("Extension connection lost");
  } finally { await page.close(); }
});

test("Incognito never authorizes or mounts the distribution", async () => {
  const context = await browser.createBrowserContext();
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4173/page-exit/");
    await page.bringToFront();
    const allowed = await worker.evaluate(() => (globalThis as unknown as {
      chrome: { extension: { isAllowedIncognitoAccess(): Promise<boolean> } };
    }).chrome.extension.isAllowedIncognitoAccess());
    expect(allowed).toBe(false);
    expect(await page.$$("[data-ui-torture-lab-root]")).toHaveLength(0);
    expect(await page.$eval("#boundary", (element) => element.textContent)).toBe("Checkout");
  } finally { await context.close(); }
});

test("extension runtime interruption leaves a visible limitation and local Page Exit cleanup", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/page-exit/");
    await page.bringToFront();
    await triggerFixtureAction(page, extension);
    await expect.poll(() => panelText(page)).toContain("Apply Long Text");
    await click(page, "Apply Long Text");
    await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
    await browser.uninstallExtension(extensionId);
    await expect.poll(() => panelText(page)).toContain("Extension connection lost");
    expect(await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
      return document.querySelector("#boundary")?.textContent;
    })).toBe("Checkout");
  } finally { await page.close(); }
});
