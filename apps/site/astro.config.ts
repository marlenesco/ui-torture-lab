// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  site: process.env.SITE_URL ?? "http://localhost:4321",
  trailingSlash: "always",
});
