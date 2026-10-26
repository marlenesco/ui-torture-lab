// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";
import path from "node:path";
import puppeteer, { type Page } from "puppeteer-core";
import { triggerFixtureAction } from "../support/extension-action";

const click = (page: Page, label: string) => page.locator(`::-p-aria(${label})`).setTimeout(5000).click();
const paint = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

async function geometry(page: Page, selector: string, ranges = false) {
  return page.evaluate(({ selector, ranges }) => {
    const subject = document.querySelector(selector)!;
    const range = document.createRange(); range.selectNodeContents(subject);
    const target = ranges ? range.getBoundingClientRect() : subject.getBoundingClientRect();
    const highlight = document.querySelector("[data-ui-torture-lab-overlay-root]")?.shadowRoot?.querySelector("[data-ui-torture-lab-highlight]")?.getBoundingClientRect();
    return { target: { x: target.x, y: target.y, width: target.width, height: target.height }, highlight: highlight ? { x: highlight.x, y: highlight.y, width: highlight.width, height: highlight.height } : null, viewport: { width: innerWidth, height: innerHeight }, scrollY };
  }, { selector, ranges });
}

async function expectAligned(page: Page, selector: string, ranges = false) {
  await expect.poll(async () => {
    const { target, highlight } = await geometry(page, selector, ranges);
    return highlight === null ? Infinity : Math.max(...(["x", "y", "width", "height"] as const).map(key => Math.abs(target[key] - highlight[key])));
  }).toBeLessThan(1);
}

async function withRun(work: (page: Page) => Promise<void>, { fixture = "inspection-highlights", scenario = "Long Text" } = {}) {
  const browser = await puppeteer.launch({ executablePath: await puppeteer.executablePath("chrome"), headless: true, enableExtensions: true });
  try {
    const id = await browser.installExtension(path.resolve("apps/extension/.output/chrome-mv3"));
    const extension = (await browser.extensions()).get(id);
    if (extension === undefined) throw new Error("Built extension unavailable");
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 700 });
    await page.goto(`http://127.0.0.1:4173/${fixture}/`);
    await page.bringToFront();
    await triggerFixtureAction(page, extension);
    await click(page, `Apply ${scenario}`);
    await page.waitForFunction(scenario => document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.textContent?.includes(`${scenario} Scenario active`), {}, scenario);
    await work(page);
  } finally { await browser.close(); }
}

for (const ranges of [false, true]) {
  test(`${ranges ? "range" : "subject"} highlight reveals an offscreen Finding without smooth-scroll drift`, async () => withRun(async page => {
    expect((await geometry(page, "#boundary")).target.y).toBeGreaterThan(700);
    await click(page, ranges ? "Highlight affected ranges for p#boundary" : "Highlight Finding Subject p#boundary");
    const state = await geometry(page, "#boundary", ranges);
    expect(state.target.y).toBeGreaterThanOrEqual(0);
    expect(state.target.y + state.target.height).toBeLessThanOrEqual(state.viewport.height);
    await expectAligned(page, "#boundary", ranges);
    await paint(page);
    await expectAligned(page, "#boundary", ranges);
  }));
}

test("subject highlight follows page scroll and viewport resize", async () => withRun(async page => {
  await click(page, "Navigate to Finding Subject p#boundary");
  await click(page, "Highlight Finding Subject p#boundary");
  await page.evaluate(() => window.scrollBy({ top: 100, behavior: "instant" }));
  await expectAligned(page, "#boundary");
  await page.setViewport({ width: 800, height: 600 });
  await expectAligned(page, "#boundary");
}));

test("range highlight follows nested scrolling and keeps the first affected range visible", async () => withRun(async page => {
  await click(page, "Highlight affected ranges for p#nested-boundary");
  await expectAligned(page, "#nested-boundary", true);
  const state = await geometry(page, "#nested-boundary", true);
  expect(state.target.y).toBeGreaterThanOrEqual(0);
  expect(state.target.y).toBeLessThan(state.viewport.height);
  await page.$eval("#scroller", node => { node.scrollTop -= 40; });
  await expectAligned(page, "#nested-boundary", true);
}));

for (const action of ["Restore", "Close UI Torture Lab", "Observed navigation"] as const) {
  test(`${action} clears live highlights and prevents scroll callbacks from reviving them`, async () => withRun(async page => {
    await click(page, "Navigate to Finding Subject p#boundary");
    await click(page, "Highlight Finding Subject p#boundary");
    await page.evaluate(() => window.scrollBy({ top: 20, behavior: "instant" }));
    if (action === "Observed navigation") await page.evaluate(() => { location.hash = "ended"; });
    else await click(page, action);
    await page.evaluate(() => window.scrollBy({ top: 30, behavior: "instant" }));
    await page.setViewport({ width: 800, height: 600 });
    await paint(page);
    expect((await geometry(page, "#boundary")).highlight).toBeNull();
    if (action === "Close UI Torture Lab") expect(await page.$$("[data-ui-torture-lab-root], [data-ui-torture-lab-overlay-root]")).toHaveLength(0);
  }));
}

test("a disconnected Finding clears its tracked highlight instead of using a matching replacement", async () => withRun(async page => {
  await click(page, "Highlight Finding Subject p#boundary");
  await page.$eval("#boundary", node => { node.replaceWith(node.cloneNode(true)); });
  await page.evaluate(() => window.scrollBy({ top: 20, behavior: "instant" }));
  await paint(page);
  expect((await geometry(page, "#boundary")).highlight).toBeNull();
}));

test("Viewport Overflow highlight reveals and tracks its live Primary Contributor", async () => withRun(async page => {
  await page.locator('[data-ui-torture-lab-root] >>> section[aria-label="Viewport Overflow Findings"] button[aria-label^="Highlight Finding Subject"]').setTimeout(5000).click();
  const state = await geometry(page, "#ltr-primary");
  expect(state.target.x).toBeLessThan(state.viewport.width);
  expect(state.target.x + state.target.width).toBeGreaterThan(0);
  expect(state.target.y).toBeLessThan(state.viewport.height);
  expect(state.target.y + state.target.height).toBeGreaterThan(0);
  await expectAligned(page, "#ltr-primary");
  await page.evaluate(() => window.scrollBy({ left: -40, behavior: "instant" }));
  await expectAligned(page, "#ltr-primary");
}, { fixture: "viewport-overflow-run", scenario: "Unbreakable Text" }));
