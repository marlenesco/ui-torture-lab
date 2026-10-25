// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";
import { triggerFixtureAction } from "../support/extension-action";
import { waitForExtensionPanel } from "../support/extension-panel";
import { observeMarkdownDownloads } from "../support/markdown-download";
import { executeAsyncInIsolated } from "../support/extension-script";
import path from "node:path";
import puppeteer, { type Browser, type Extension, type Page, type WebWorker } from "puppeteer-core";

type DownloadMode = "success" | "create-failed" | "click-failed";
type ChromeApi = {
  readonly storage: { readonly session: { get(key: null): Promise<Record<string, unknown>> } };
  readonly tabs: { query(details: { active: true; currentWindow: true }): Promise<{ id?: number }[]> };

};

test.describe.configure({ mode: "serial" });
let browser: Browser;
let extension: Extension;
let worker: WebWorker;

test.beforeAll(async () => {
  browser = await puppeteer.launch({
    executablePath: await puppeteer.executablePath("chrome"), headless: true, enableExtensions: true,
  });
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

// Fault injection changes only the native export boundary, never the report or formatter.
const downloadProbe = (mode: DownloadMode): Promise<boolean[]> => executeAsyncInIsolated(worker, async (mode: DownloadMode) => {
  const scope = globalThis as unknown as { reportDownloadProbe?: {
    create: typeof URL.createObjectURL; click: typeof HTMLAnchorElement.prototype.click; gestures: boolean[];
  } };
  const probe = scope.reportDownloadProbe ??= { create: URL.createObjectURL.bind(URL), click: HTMLAnchorElement.prototype.click, gestures: [] };
  URL.createObjectURL = blob => {
    probe.gestures.push(navigator.userActivation.isActive);
    if (mode === "create-failed") throw new Error("Synthetic object URL failure");
    return probe.create(blob);
  };
  HTMLAnchorElement.prototype.click = function () {
    if (mode === "click-failed") throw new Error("Synthetic download activation failure");
    return probe.click.call(this);
  };
  return probe.gestures;
}, mode);

const preview = (page: Page): Promise<string> => page.$eval(
  '[data-ui-torture-lab-root] >>> textarea[aria-label="Markdown preview"]',
  (element) => (element as HTMLTextAreaElement).value,
);
const waitForPreview = (page: Page): Promise<void> => expect.poll(() => page.evaluate(() =>
  document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
    ?.querySelector('[aria-label="Markdown preview"]') instanceof HTMLTextAreaElement
)).toBe(true);

const panelText = (page: Page): Promise<string | null> => page.$eval(
  "[data-ui-torture-lab-root]", (host) => host.shadowRoot?.textContent ?? null,
);
const click = (page: Page, name: string): Promise<void> => test.step(`Panel click: ${name}`, () => page.locator(`::-p-aria(${name})`).setTimeout(5000).click());

async function completedRun(page: Page): Promise<void> {
  await test.step("Navigate to download fixture", () => page.goto("http://127.0.0.1:4173/text-clipping-run/?private=query#fragment"), { timeout: 5000 });
  await test.step("Activate download fixture tab", () => page.bringToFront(), { timeout: 5000 });
  await test.step("Authorize download fixture by toolbar", () => triggerFixtureAction(page, extension), { timeout: 5000 });
  await test.step("Mount download fixture panel", () => waitForExtensionPanel(page), { timeout: 5000 });
  await click(page, "Apply Long Text");
  await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
  await click(page, "Restore");
  await waitForPreview(page);
}

test("built extension downloads the exact preview UTF-8 Markdown only on a user click after Restore", async () => {
  const page = await test.step("Create download fixture tab", () => browser.newPage(), { timeout: 5000 });
  const downloads = await observeMarkdownDownloads(browser);
  try {
    await page.goto("http://127.0.0.1:4173/text-clipping-run/");
    await page.bringToFront();
    await triggerFixtureAction(page, extension);
    await downloadProbe("success");
    await click(page, "Apply Long Text");
    await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
    expect(downloads.count()).toBe(0);
    await click(page, "Restore");
    await waitForPreview(page);
    const markdown = await preview(page);
    expect(markdown).toContain("### Text Clipping");
    expect(markdown).toContain("Restore status: restored");
    expect(markdown).not.toContain("No supported Finding was produced");
    expect(downloads.count()).toBe(0);
    await page.$eval("#clipping-boundary", (element) => { element.textContent = "NEW PAGE CONTENT MUST NOT BE EXPORTED"; });
    const file = await downloads.capture(() => click(page, "Download Report"));
    await expect.poll(() => panelText(page)).toContain("Markdown download requested.");
    expect(await preview(page)).toBe(markdown);
    expect(file.filename).toBe("ui-torture-lab-report.md");
    expect(file.url).toMatch(/^blob:/u);
    expect(file.bytes).toEqual(Buffer.from(markdown, "utf8"));
    expect(markdown).toContain("—");
    expect(await downloadProbe("success")).toEqual([true]);
    const repeat = await downloads.capture(() => click(page, "Download Report"));
    expect(repeat.filename).toBe(file.filename);
    expect(repeat.bytes).toEqual(file.bytes);
    expect(downloads.count()).toBe(2);
  } finally { await downloads.dispose(); await page.close(); }
});

for (const mode of ["create-failed", "click-failed"] as const) {
  test(`built extension preserves selectable Markdown when download is ${mode}`, async () => {
    const page = await browser.newPage();
    const downloads = await observeMarkdownDownloads(browser);
    try {
      await completedRun(page);
      const markdown = await preview(page);
      expect(markdown).not.toContain("private=query");
      expect(markdown).not.toContain("fragment");
      await downloadProbe(mode);
      await click(page, "Download Report");
      await expect.poll(() => panelText(page)).toContain("Download unavailable. Select the Markdown below and save it as a .md file.");
      expect(await preview(page)).toBe(markdown);
      expect(downloads.count()).toBe(0);
      await click(page, "Markdown preview");
      const selection = await page.$eval('[data-ui-torture-lab-root] >>> textarea[aria-label="Markdown preview"]', element => {
        const textarea = element as HTMLTextAreaElement;
        return textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
      });
      expect(selection).toBe(markdown);
      await downloadProbe("success");
      const file = await downloads.capture(() => click(page, "Download Report"));
      expect(file.bytes).toEqual(Buffer.from(markdown, "utf8"));
      await expect.poll(() => panelText(page)).toContain("Markdown download requested.");
    } finally { await downloads.dispose(); await page.close(); }
  });
}

test("Previous-Target Snapshot remains downloadable after reload with no live Finding actions", async () => {
  const page = await test.step("Create download fixture tab", () => browser.newPage(), { timeout: 5000 });
  const downloads = await observeMarkdownDownloads(browser);
  try {
    await completedRun(page);
    const current = await preview(page);
    // Wait for this tab's result, rather than a result still being removed for a closed tab.
    await expect.poll(() => worker.evaluate(async () => {
      const api = (globalThis as unknown as { chrome: ChromeApi }).chrome;
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      const stored = await api.storage.session.get(null);
      const session = stored[`ui-torture-lab:tab-session:${tab?.id}`] as { id?: string } | undefined;
      const result = stored[`ui-torture-lab:current-run-result:${session?.id}`] as { state?: string } | undefined;
      return result?.state;
    })).toBe("current");
    await page.reload();
    await triggerFixtureAction(page, extension);
    await waitForExtensionPanel(page);
    await waitForPreview(page);
    const markdown = await preview(page);
    expect(markdown.replace("- Termination reason: page\\-exit\n", "")).toBe(current.replace("Lifecycle: Current Run Result", "Lifecycle: Previous-Target Snapshot") + "This Previous-Target Snapshot has no live DOM actions; elements are not rematched.\n");
    expect(await panelText(page)).not.toContain("Highlight subject");
    expect(await panelText(page)).not.toContain("Navigate");

    await page.$eval("#clipping-boundary", (element) => element.remove());
    const file = await downloads.capture(() => click(page, "Download Report"));
    await expect.poll(() => panelText(page)).toContain("Markdown download requested.");
    expect(file.bytes).toEqual(Buffer.from(markdown, "utf8"));
    await click(page, "Clear saved result");
    expect(await page.$('[data-ui-torture-lab-root] >>> textarea[aria-label="Markdown preview"]')).toBeNull();
  } finally { await downloads.dispose(); await page.close(); }
});

test("a zero-Finding result remains downloadable as Markdown", async () => {
  const page = await browser.newPage();
  const downloads = await observeMarkdownDownloads(browser);
  try {
    await page.goto("http://127.0.0.1:4173/product-validation/c/");
    await page.bringToFront();
    await triggerFixtureAction(page, extension);
    await click(page, "Apply Long Text");
    await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
    await click(page, "Restore");
    await waitForPreview(page);
    const markdown = await preview(page);
    expect(markdown).toContain("No Findings were produced.");
    const file = await downloads.capture(() => click(page, "Download Report"));
    expect(file.bytes).toEqual(Buffer.from(markdown, "utf8"));
  } finally { await downloads.dispose(); await page.close(); }
});

test("Restore conflicts keep the reload-required result available for download", async () => {
  const page = await test.step("Create download fixture tab", () => browser.newPage(), { timeout: 5000 });
  const downloads = await observeMarkdownDownloads(browser);
  try {
    await page.goto("http://127.0.0.1:4173/text-clipping-run/");
    await page.bringToFront();
    await triggerFixtureAction(page, extension);
    await click(page, "Apply Long Text");
    await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
    await page.$eval("#clipping-boundary", (element) => { element.textContent = "External change"; });
    await click(page, "Restore");
    await waitForPreview(page);
    const markdown = await preview(page);
    expect(markdown).toContain("Restore status: conflict");
    expect(markdown).toContain("Reload required: yes");
    expect(markdown).toContain("target\\-disconnected");
    expect(await panelText(page)).toContain("Reload required");

    const file = await downloads.capture(() => click(page, "Download Report"));
    await expect.poll(() => panelText(page)).toContain("Markdown download requested.");
    expect(file.bytes).toEqual(Buffer.from(markdown, "utf8"));
    expect(await page.$eval("#clipping-boundary", (element) => element.textContent)).toBe("External change");
  } finally { await downloads.dispose(); await page.close(); }
});

test("Markdown preview stays collapsed until its plain icon is activated and downloads stay identical", async () => {
  const page = await browser.newPage();
  const downloads = await observeMarkdownDownloads(browser);
  try {
    await completedRun(page);
    const markdown = await preview(page);
    const visible = () => page.$eval('[data-ui-torture-lab-root] >>> textarea[aria-label="Markdown preview"]', element => element.getClientRects().length > 0);
    expect(await visible()).toBe(false);
    const disclosure = await page.$("::-p-aria(Show Markdown preview)");
    if (disclosure === null) throw new Error("Preview disclosure unavailable");
    expect(await disclosure.evaluate(button => ({ expanded: button.getAttribute("aria-expanded"), background: getComputedStyle(button).backgroundColor, border: getComputedStyle(button).borderStyle,
      iconBackground: getComputedStyle(button.querySelector("svg") as SVGElement).backgroundColor,
      targetExists: (button.getRootNode() as ShadowRoot).getElementById(button.getAttribute("aria-controls") ?? "") !== null,
    }))).toEqual({ expanded: "false", background: "rgba(0, 0, 0, 0)", border: "none", iconBackground: "rgba(0, 0, 0, 0)", targetExists: true });
    const reportSection = await page.$('[data-ui-torture-lab-root] >>> .markdown-report');
    if (reportSection === null) throw new Error("Markdown Report section unavailable");
    await reportSection.screenshot({ path: test.info().outputPath("report-collapsed.png") });
    await disclosure.focus();
    await page.keyboard.press("Enter");
    await expect.poll(visible).toBe(true);
    const hide = await page.$("::-p-aria(Hide Markdown preview)");
    expect(await hide?.evaluate(button => button.getAttribute("aria-expanded"))).toBe("true");
    expect(await preview(page)).toBe(markdown);
    expect(downloads.count()).toBe(0);
    await click(page, "Hide Markdown preview");
    expect(await visible()).toBe(false);
    const file = await downloads.capture(() => click(page, "Download Report"));
    expect(file.bytes).toEqual(Buffer.from(markdown, "utf8"));
    expect(await visible()).toBe(false);
  } finally { await downloads.dispose(); await page.close(); }
});
