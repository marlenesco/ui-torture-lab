// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from "wxt";

export default defineConfig({
  manifestVersion: 3,
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
  manifest: {
    name: "UI Torture Lab",
    description:
      "Deterministic text stress testing for measurable layout regressions.",
    version: "0.0.0",
    incognito: "not_allowed",
    minimum_chrome_version: "155",
    permissions: ["activeTab", "scripting", "storage"],
    action: {
      default_title: "Open UI Torture Lab",
    },
  },
});
