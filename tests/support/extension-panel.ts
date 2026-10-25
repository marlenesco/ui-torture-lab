// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";
import type { Page } from "puppeteer-core";

/** Observe the shared Target DOM directly instead of a utility-world mutation poller. */
export async function waitForExtensionPanel(page: Page): Promise<void> {
  await test.step("Observe Extension UI host in the Target DOM", async () => {
    await expect.poll(() => page.evaluate(() => document.querySelector("[data-ui-torture-lab-root]") !== null), { timeout: 5000 }).toBe(true);
  });
}
