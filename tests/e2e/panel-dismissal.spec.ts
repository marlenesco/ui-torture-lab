// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { triggerFixtureAction } from "../support/extension-action";

for (const state of ["idle", "active", "completed", "navigation"] as const) {
  test(`closing the ${state} panel removes all controls until another toolbar action`, async () => {
    const browser = await puppeteer.launch({ executablePath: await puppeteer.executablePath("chrome"), headless: true, enableExtensions: true });
    try {
      const id = await browser.installExtension(path.resolve("apps/extension/.output/chrome-mv3"));
      const extension = (await browser.extensions()).get(id);
      if (extension === undefined) throw new Error("Built extension unavailable");
      const page = await browser.newPage();
      await page.goto("http://127.0.0.1:4173/page-exit/");
      await page.bringToFront();
      await triggerFixtureAction(page, extension);
      const panelText = () => page.evaluate(() => document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.textContent ?? "");
      await expect.poll(panelText).toContain("Apply Long Text");
      const icons = await page.evaluate(() => [...(document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.querySelectorAll("button") ?? [])].map(button => ({
        leadingSvg: button.firstElementChild?.tagName.toLowerCase() === "svg",
        hidden: button.firstElementChild?.getAttribute("aria-hidden"),
        focusable: button.firstElementChild?.getAttribute("focusable"),
      })));
      expect(icons).toHaveLength(6);
      expect(icons.every(icon => icon.leadingSvg && icon.hidden === "true" && icon.focusable === "false")).toBe(true);
      const runtime = await page.$eval("[data-ui-torture-lab-root]", host => host.getAttribute("data-ui-torture-lab-runtime-id"));
      const countSurfaces = () => page.evaluate(() => document.querySelectorAll("[data-ui-torture-lab-root], [data-ui-torture-lab-overlay-root]").length);

      if (state !== "idle") {
        // Clicking the SVG itself must dispatch the button's action once.
        const start = await page.$("::-p-aria(Apply Long Text)");
        const svg = await start?.$("svg");
        expect(svg).toBeTruthy();
        await svg?.click();
        await expect.poll(panelText).toContain("Long Text Scenario active");
        if (state === "completed") await page.locator("::-p-aria(Restore)").setTimeout(5000).click();
        else {
          await page.locator("::-p-aria(Highlight Finding Subject p#boundary)").setTimeout(5000).click();
          expect(await page.evaluate(() => document.querySelector("[data-ui-torture-lab-overlay-root]")?.shadowRoot?.querySelectorAll("[data-ui-torture-lab-highlight]").length)).toBeGreaterThan(0);
        }
      }
      const beforeClose = await page.$eval("#boundary", node => node.textContent);
      if (state === "active") await page.screenshot({ path: test.info().outputPath("panel-icons.png") });
      await page.locator("::-p-aria(Quick guide)").setTimeout(5000).click();
      expect(await page.$('[data-ui-torture-lab-root] >>> [role="dialog"]')).not.toBeNull();
      const close = await page.$("::-p-aria(Close UI Torture Lab)");
      const closeIcon = await close?.$("svg");
      expect(closeIcon).toBeTruthy();
      await closeIcon?.click();
      await expect.poll(countSurfaces).toBe(0);
      expect(await page.$eval("#boundary", node => node.textContent)).toBe(beforeClose);

      if (state === "navigation") {
        await page.evaluate(() => { location.hash = "after-close"; });
        await expect.poll(() => page.$eval("#boundary", node => node.textContent)).toBe("Checkout");
      }
      // Observe a subsequent render opportunity; background messages must not remount the closed UI.
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      expect(await countSurfaces()).toBe(0);
      expect(await page.$eval("ui-torture-lab-runtime", marker => ({display: getComputedStyle(marker).display, hidden: marker.getAttribute("aria-hidden"), controls: marker.querySelectorAll("button").length}))).toEqual({display:"none", hidden:"true", controls:0});
      await triggerFixtureAction(page, extension);
      await expect.poll(countSurfaces).toBe(2);
      expect(await page.$$("ui-torture-lab-runtime")).toHaveLength(0);
      expect(await page.$eval("[data-ui-torture-lab-root]", host => host.getAttribute("data-ui-torture-lab-runtime-id"))).toBe(runtime);
      expect(await page.$('[data-ui-torture-lab-root] >>> [role="dialog"]')).toBeNull();
      expect(await page.evaluate(() => document.querySelector("[data-ui-torture-lab-overlay-root]")?.shadowRoot?.querySelectorAll("[data-ui-torture-lab-highlight]").length)).toBe(0);
      if (state === "active") {
        await expect.poll(panelText).toContain("Long Text Scenario active");
        expect(await page.$eval("#boundary", node => node.textContent)).toBe(beforeClose);
        await page.locator("::-p-aria(Restore)").setTimeout(5000).click();
      } else if (state === "completed") await expect.poll(panelText).toContain("Restore completed");
      else if (state === "navigation") await expect.poll(panelText).toContain("Previous Target Snapshot");
      else await expect.poll(panelText).toContain("Apply Long Text");
      expect(await page.$eval("#boundary", node => node.textContent)).toBe("Checkout");
    } finally { await browser.close(); }
  });
}
