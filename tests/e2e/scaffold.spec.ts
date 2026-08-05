// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";

test("synthetic fixture is available over HTTP", async ({ page }) => {
  await page.goto("/smoke/");

  await expect(page).toHaveTitle("UI Torture Lab fixture");
  await expect(
    page.getByRole("heading", { level: 1, name: "Synthetic layout fixture" }),
  ).toBeVisible();
  await expect(page.locator("main")).toHaveAttribute(
    "data-fixture",
    "workspace-smoke",
  );
});
