// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from "wxt";

const icons = { 16: "icons/icon-16.png", 32: "icons/icon-32.png", 48: "icons/icon-48.png", 128: "icons/icon-128.png" };

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
    icons,
    action: {
      default_title: "Open UI Torture Lab",
      default_icon: icons,
    },
  },
});
