// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";

test.use({ javaScriptEnabled: false });
test.beforeEach(async ({ page }) => {
  // Serve generated root-relative assets and links through the fixture server's static mount.
  await page.route("http://127.0.0.1:4173/**", async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith("/__site__/")) url.pathname = `/__site__${url.pathname}`;
    await route.continue({ url: url.href });
  });
});

test("essential website navigation works without JavaScript and exposes keyboard focus", async ({ page }) => {
  await page.goto("/__site__/");
  await expect(page.getByRole("heading", { level: 1, name: "UI Torture Lab" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.goto("/__site__/");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const usage = page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Usage", exact: true });
  await expect(usage).toBeFocused();
  expect(await usage.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "From Run to Evidence." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Usage", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Supported Scope", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Measure within the boundary." })).toBeVisible();
});

for (const width of [360, 800, 1280]) {
  test(`static routes remain readable at ${width}px with reduced motion`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    for (const route of ["/", "/docs/", "/scope/", "/install/"]) {
      await page.goto(`/__site__${route}`);
      await expect(page.locator("h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator("body").evaluate((element) => getComputedStyle(element).fontSize)).not.toBe("0px");
    }
    expect(requests.every((url) => new URL(url).origin === "http://127.0.0.1:4173")).toBe(true);
    await page.goto("/__site__/");
    expect(await page.locator(".specimen").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  });
}
