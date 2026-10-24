// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";
import path from "node:path";
import puppeteer, { type Browser, type Extension, type Page, type WebWorker } from "puppeteer-core";

type ClipboardMode = "success" | "denied" | "unavailable";
type ClipboardProbe = { readonly writes: readonly string[]; readonly gestures: readonly boolean[] };
type ChromeApi = {
  readonly storage: { readonly session: { get(key: null): Promise<Record<string, unknown>> } };
  readonly tabs: { query(details: { active: true; currentWindow: true }): Promise<{ id?: number }[]> };
  readonly scripting: {
    executeScript(details: {
      target: { tabId: number; frameIds: number[] };
      world: "ISOLATED";
      args: ClipboardMode[];
      func: (mode: ClipboardMode) => ClipboardProbe;
    }): Promise<{ result?: ClipboardProbe }[]>;
  };
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

// Replace only the external Clipboard API in the same world as the installed extension.
const clipboardProbe = (mode: ClipboardMode): Promise<ClipboardProbe> => worker.evaluate(async (mode) => {
  const chromeApi = (globalThis as unknown as { chrome: ChromeApi }).chrome;
  const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) throw new Error("Fixture tab unavailable");
  const [injection] = await chromeApi.scripting.executeScript({
    target: { tabId: tab.id, frameIds: [0] }, world: "ISOLATED", args: [mode],
    func: (mode) => {
      const scope = globalThis as unknown as { clipboardProbe?: { writes: string[]; gestures: boolean[] } };
      const probe = scope.clipboardProbe ??= { writes: [], gestures: [] };
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: mode === "unavailable" ? undefined : {
          writeText: async (value: string) => {
            probe.writes.push(value);
            probe.gestures.push(navigator.userActivation.isActive);
            if (mode === "denied") throw new DOMException("Clipboard denied", "NotAllowedError");
          },
        },
      });
      return probe;
    },
  });
  if (injection?.result === undefined) throw new Error("Clipboard probe unavailable");
  return injection.result;
}, mode);

const preview = (page: Page): Promise<string> => page.$eval(
  '[data-ui-torture-lab-root] >>> textarea[aria-label="Markdown preview"]',
  (element) => (element as HTMLTextAreaElement).value,
);
const panelText = (page: Page): Promise<string | null> => page.$eval(
  "[data-ui-torture-lab-root]", (host) => host.shadowRoot?.textContent ?? null,
);
const click = (page: Page, name: string): Promise<void> => page.locator(`::-p-aria(${name})`).setTimeout(5000).click();

async function completedRun(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:4173/text-clipping-run/?private=query#fragment");
  await page.bringToFront();
  await page.triggerExtensionAction(extension);
  await page.waitForSelector("[data-ui-torture-lab-root]");
  await click(page, "Apply Long Text");
  await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
  await click(page, "Restore");
  await page.waitForSelector('[data-ui-torture-lab-root] >>> textarea[aria-label="Markdown preview"]');
}

test("built extension copies the exact visible Markdown only on a user click after Restore", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/text-clipping-run/");
    await page.bringToFront();
    await page.triggerExtensionAction(extension);
    await clipboardProbe("success");
    await click(page, "Apply Long Text");
    await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
    expect((await clipboardProbe("success")).writes).toEqual([]);
    await click(page, "Restore");
    await page.waitForSelector('[data-ui-torture-lab-root] >>> textarea[aria-label="Markdown preview"]');
    const markdown = await preview(page);
    expect(markdown).toContain("### Text Clipping");
    expect(markdown).toContain("Restore status: restored");
    expect(markdown).not.toContain("No supported Finding was produced");
    expect((await clipboardProbe("success")).writes).toEqual([]);
    await page.$eval("#clipping-boundary", (element) => { element.textContent = "NEW PAGE CONTENT MUST NOT BE EXPORTED"; });
    await click(page, "Copy Report as Markdown");
    await expect.poll(() => panelText(page)).toContain("Markdown copied.");
    expect(await preview(page)).toBe(markdown);
    expect(await clipboardProbe("success")).toEqual({ writes: [markdown], gestures: [true] });
    await click(page, "Copy Report as Markdown");
    expect((await clipboardProbe("success")).writes).toEqual([markdown, markdown]);
  } finally { await page.close(); }
});

for (const mode of ["denied", "unavailable"] as const) {
  test(`built extension keeps full selectable Markdown when clipboard is ${mode}`, async () => {
    const page = await browser.newPage();
    try {
      await completedRun(page);
      const markdown = await preview(page);
      expect(markdown).not.toContain("private=query");
      expect(markdown).not.toContain("fragment");
      expect((await clipboardProbe(mode)).writes).toEqual([]);
      await click(page, "Copy Report as Markdown");
      await expect.poll(() => panelText(page)).toContain("Clipboard unavailable. Select the Markdown below and copy it manually.");
      expect(await preview(page)).toBe(markdown);
      await click(page, "Markdown preview");
      const selection = await page.$eval(
        '[data-ui-torture-lab-root] >>> textarea[aria-label="Markdown preview"]',
        (element) => {
          const textarea = element as HTMLTextAreaElement;
          return textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
        },
      );
      expect(selection).toBe(markdown);
      expect((await clipboardProbe(mode)).writes).toEqual(mode === "denied" ? [markdown] : []);
      // A retry succeeds without a new Run or loss of the serialized result.
      await clipboardProbe("success");
      await click(page, "Copy Report as Markdown");
      await expect.poll(() => panelText(page)).toContain("Markdown copied.");
      expect((await clipboardProbe("success")).writes.at(-1)).toBe(markdown);
    } finally { await page.close(); }
  });
}

test("Previous-Target Snapshot remains copyable after reload with no live Finding actions", async () => {
  const page = await browser.newPage();
  try {
    await completedRun(page);
    const current = await preview(page);
    // Establish that the asynchronous session write completed before replacing its Document.
    await expect.poll(() => worker.evaluate(async () => {
      const api = (globalThis as unknown as { chrome: ChromeApi }).chrome;
      return Object.keys(await api.storage.session.get(null))
        .filter((key) => key.startsWith("ui-torture-lab:current-run-result:")).length;
    })).toBe(1);
    await page.reload();
    await page.triggerExtensionAction(extension);
    await page.waitForSelector("[data-ui-torture-lab-root]");
    await page.waitForSelector('[data-ui-torture-lab-root] >>> textarea[aria-label="Markdown preview"]', { timeout: 5000 });
    const markdown = await preview(page);
    expect(markdown).toBe(current.replace("Lifecycle: Current Run Result", "Lifecycle: Previous-Target Snapshot") + "This Previous-Target Snapshot has no live DOM actions; elements are not rematched.\n");
    expect(await panelText(page)).not.toContain("Highlight subject");
    expect(await panelText(page)).not.toContain("Navigate");
    await clipboardProbe("success");
    await page.$eval("#clipping-boundary", (element) => element.remove());
    await click(page, "Copy Report as Markdown");
    await expect.poll(() => panelText(page)).toContain("Markdown copied.");
    expect(await clipboardProbe("success")).toEqual({ writes: [markdown], gestures: [true] });
    await click(page, "Clear saved result");
    expect(await page.$('[data-ui-torture-lab-root] >>> textarea[aria-label="Markdown preview"]')).toBeNull();
  } finally { await page.close(); }
});

test("Chrome copies the report through its native permissionless Clipboard API", async () => {
  const page = await browser.newPage();
  try {
    await completedRun(page);
    const markdown = await preview(page);
    await click(page, "Copy Report as Markdown");
    await expect.poll(() => panelText(page)).toContain("Markdown copied.");
    expect(await preview(page)).toBe(markdown);
  } finally { await page.close(); }
});

test("Restore conflicts keep the reload-required result available for copying", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/text-clipping-run/");
    await page.bringToFront();
    await page.triggerExtensionAction(extension);
    await click(page, "Apply Long Text");
    await expect.poll(() => panelText(page)).toContain("Long Text Scenario active");
    await page.$eval("#clipping-boundary", (element) => { element.textContent = "External change"; });
    await click(page, "Restore");
    await page.waitForSelector('[data-ui-torture-lab-root] >>> textarea[aria-label="Markdown preview"]');
    const markdown = await preview(page);
    expect(markdown).toContain("Restore status: conflict");
    expect(markdown).toContain("Reload required: yes");
    expect(markdown).toContain("target\\-disconnected");
    expect(await panelText(page)).toContain("Reload required");
    await clipboardProbe("success");
    await click(page, "Copy Report as Markdown");
    await expect.poll(() => panelText(page)).toContain("Markdown copied.");
    expect((await clipboardProbe("success")).writes).toEqual([markdown]);
    expect(await page.$eval("#clipping-boundary", (element) => element.textContent)).toBe("External change");
  } finally { await page.close(); }
});
