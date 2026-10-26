// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";
import path from "node:path";
import puppeteer, { type Page, type WebWorker } from "puppeteer-core";
import { triggerFixtureAction } from "../support/extension-action";
import { executeAsyncInIsolated } from "../support/extension-script";

const click = (page: Page, label: string) => page.locator(`::-p-aria(${label})`).setTimeout(5000).click();
const text = (page: Page) => page.$eval("[data-ui-torture-lab-root]", host => host.shadowRoot?.textContent ?? "");

async function withPanel(work: (page: Page, worker: WebWorker) => Promise<void>, fixture = "text-clipping-run") {
  const browser = await puppeteer.launch({ executablePath: await puppeteer.executablePath("chrome"), headless: true, enableExtensions: true });
  try {
    const id = await browser.installExtension(path.resolve("apps/extension/.output/chrome-mv3"));
    const extension = (await browser.extensions()).get(id);
    if (extension === undefined) throw new Error("Built extension unavailable");
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:4173/${fixture}/`);
    await page.bringToFront();
    await triggerFixtureAction(page, extension);
    await page.waitForSelector("[data-ui-torture-lab-root]");
    const target = await browser.waitForTarget(target => target.type() === "service_worker" && target.url().includes(id));
    const worker = await target.worker();
    if (worker === null) throw new Error("Extension worker unavailable");
    await work(page, worker);
  } finally { await browser.close(); }
}

async function run(page: Page) {
  await click(page, "Apply Long Text");
  await expect.poll(() => text(page)).toContain("Long Text Scenario active");
}

async function mockClipboard(worker: WebWorker, outcome: "success" | "denied" | "missing") {
  await executeAsyncInIsolated(worker, async outcome => {
    const writes: { text: string; active: boolean }[] = [];
    Object.assign(globalThis, { locatorWrites: writes });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: outcome === "missing" ? undefined : {
      async writeText(text: string) {
        writes.push({ text, active: navigator.userActivation.isActive });
        if (outcome === "denied") throw new DOMException("Blocked", "NotAllowedError");
      },
    } });
  }, outcome);
}

test("plain information control explains actions, supports keyboard dismissal and fits a narrow panel", async () => withPanel(async page => {
  await page.setViewport({ width: 320, height: 650 });
  const geometry = () => page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
  const before = await geometry();
  const info = await page.$("::-p-aria(Quick guide)");
  expect(info).not.toBeNull();
  expect(await info!.evaluate(node => ({ expanded: node.getAttribute("aria-expanded"), title: node.getAttribute("title"), background: getComputedStyle(node).backgroundColor, tile: node.querySelector(".panel-icon") !== null }))).toEqual({ expanded: "false", title: "Quick guide to panel actions", background: "rgba(0, 0, 0, 0)", tile: false });
  await info!.focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-ui-torture-lab-root] >>> [role="dialog"]');
  expect(await text(page)).toContain("not guaranteed to be a unique selector");
  expect(await page.$eval('[data-ui-torture-lab-root]', host => host.shadowRoot?.activeElement?.getAttribute("aria-label"))).toBe("Close quick guide");
  const bounds = await info!.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(await geometry()).toEqual(before);
  await page.screenshot({ path: test.info().outputPath("quick-guide-narrow.png") });
  await page.keyboard.press("Escape");
  expect(await page.$('[data-ui-torture-lab-root] >>> [role="dialog"]')).toBeNull();
  expect(await page.$eval('[data-ui-torture-lab-root]', host => host.shadowRoot?.activeElement?.getAttribute("aria-label"))).toBe("Quick guide");
  await page.keyboard.press("Space");
  await click(page, "Close quick guide");
  expect(await info!.evaluate(node => node.getAttribute("aria-expanded"))).toBe("false");
}));

test("the open guide stays outside Run measurements and closes on collapse", async () => withPanel(async page => {
  await click(page, "Quick guide");
  await run(page);
  const evidence = () => page.$$eval('[data-ui-torture-lab-root] >>> .finding-list article', articles => articles.map(article => [...article.querySelectorAll("p")].map(p => p.textContent)));
  const withGuide = await evidence();
  expect(await text(page)).toContain("Boundary p#boundary");
  await click(page, "Collapse UI Torture Lab");
  await click(page, "Expand UI Torture Lab");
  expect(await page.$('[data-ui-torture-lab-root] >>> [role="dialog"]')).toBeNull();
  expect(await text(page)).toContain("Long Text Scenario active");
  await click(page, "Restore");
  expect(await page.$eval("#boundary", node => node.textContent)).toBe("Checkout");
  await run(page);
  expect(await evidence()).toEqual(withGuide);
  await click(page, "Restore");
}, "inspection-highlights"));

test("Copy locator writes once on a trusted click, reports success and ignores synthetic clicks", async () => withPanel(async (page, worker) => {
  await mockClipboard(worker, "success");
  await run(page);
  await click(page, "Quick guide");
  await click(page, "Close quick guide");
  await page.$eval('[data-ui-torture-lab-root] >>> button[aria-label="Copy locator p#clipping-boundary"]', node => (node as HTMLButtonElement).click());
  expect(await executeAsyncInIsolated(worker, async () => Reflect.get(globalThis, "locatorWrites"))).toEqual([]);
  await click(page, "Copy locator p#clipping-boundary");
  await expect.poll(() => text(page)).toContain("Locator copied.");
  expect(await executeAsyncInIsolated(worker, async () => Reflect.get(globalThis, "locatorWrites"))).toEqual([{ text: "p#clipping-boundary", active: true }]);
  expect(await page.evaluate(() => getSelection()?.toString())).toBe("");
}));

for (const outcome of ["denied", "missing"] as const) {
  test(`${outcome} Clipboard access selects the clicked Finding's exact locator even with duplicate labels`, async () => withPanel(async (page, worker) => {
    await mockClipboard(worker, outcome);
    await run(page);
    const controls = await page.$$('[data-ui-torture-lab-root] >>> button[aria-label="Copy locator div"]');
    expect(controls.length).toBeGreaterThanOrEqual(2);
    await controls[1]!.click();
    await expect.poll(() => text(page)).toContain("Locator selected; press Ctrl+C or ⌘C to copy.");
    expect(await page.evaluate(() => {
      const locators = document.querySelector("[data-ui-torture-lab-root]")!.shadowRoot!.querySelectorAll('article[aria-label="Finding detail div"] code[data-ui-torture-lab-diagnostic-locator]');
      const selection = getSelection();
      return { text: selection?.toString(), exact: selection?.getRangeAt(0).startContainer === locators[1] };
    })).toEqual({ text: "div", exact: true });
    expect(await text(page)).not.toContain("Locator copied.");
    expect(await executeAsyncInIsolated(worker, async () => Reflect.get(globalThis, "locatorWrites"))).toEqual(outcome === "denied" ? [{ text: "div", active: true }] : []);
  }));
}
