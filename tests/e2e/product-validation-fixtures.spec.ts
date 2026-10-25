// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";
import { triggerFixtureAction } from "../support/extension-action";
import path from "node:path";
import puppeteer, { type Browser, type Extension, type Page } from "puppeteer-core";

test.describe.configure({ mode: "serial" });
let browser: Browser;
let extension: Extension;
const panelText = (page: Page) => page.evaluate(() => document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.textContent ?? "");
const preview = (page: Page) => page.evaluate(() => document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.querySelector<HTMLTextAreaElement>("textarea")?.value ?? "");
const click = (page: Page, name: string) => page.locator(`::-p-aria(${name})`).setTimeout(5000).click();

test.beforeAll(async () => {
  browser = await puppeteer.launch({ executablePath: await puppeteer.executablePath("chrome"), headless: true, enableExtensions: true });
  const id = await browser.installExtension(path.resolve("apps/extension/.output/chrome-mv3"));
  const installed = (await browser.extensions()).get(id);
  if (installed === undefined) throw new Error("Built extension unavailable");
  extension = installed;
  const target = await browser.waitForTarget((candidate) => candidate.type() === "service_worker" && candidate.url().includes(id));
  if (await target.worker() === null) throw new Error("Built extension worker unavailable");
});
test.afterAll(async () => { await browser?.close(); });

for (const fixture of ["a", "b", "c"] as const) {
  for (const scenario of ["Long Text", "Unbreakable Text", "Large Text"] as const) {
    test(`controlled fixture ${fixture} retains its study outcome for ${scenario} through the installed UI`, async () => {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 1280, height: 900 });
        await page.goto(`http://127.0.0.1:4173/product-validation/${fixture}/`);
        await page.bringToFront();
        const original = await page.$eval("main", (element) => element.innerHTML);
        await triggerFixtureAction(page, extension);
        await expect.poll(() => panelText(page)).toContain(`Apply ${scenario}`);
        await click(page, `Apply ${scenario}`);
        await expect.poll(() => panelText(page)).toContain(`${scenario} Scenario active`);
        if (fixture === "a") expect(await panelText(page)).toContain("Text Clipping");
        if (fixture === "c") expect(await panelText(page)).toContain("0 eligible");
        await click(page, "Restore");
        await expect.poll(() => preview(page)).toContain("Restore status: restored");
        const markdown = await preview(page);
        expect(markdown).toContain(`Scenario: ${scenario}`);
        if (fixture === "a") {
          expect(markdown).toContain("### Text Clipping");
          expect(markdown).toContain("div\\#boundary");
        } else expect(markdown).toContain("No Findings were produced.");
        if (fixture === "c") expect(markdown).toContain("Eligible targets: 0");
        expect(await page.$eval("main", (element) => element.innerHTML)).toBe(original);
        await click(page, "Copy Report as Markdown");
        await expect.poll(() => panelText(page)).toContain("Markdown copied.");
        expect(await preview(page)).toBe(markdown);
      } finally { await page.close(); }
    });
  }
}
