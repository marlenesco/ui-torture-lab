// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    channel: "chrome",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev:fixtures",
    url: "http://127.0.0.1:4173/health",
    reuseExistingServer: false,
    timeout: 10_000,
  },
});
