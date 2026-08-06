// SPDX-License-Identifier: Apache-2.0

import "@ui-torture-lab/engine";
import { browser } from "wxt/browser";
import { authorizeTargetPage } from "../target-page/authorize";
import { showAuthorizationFeedback } from "../target-page/feedback";

export default defineBackground(() => {
  browser.action.onClicked.addListener(async (tab) => {
    const response = await authorizeTargetPage(tab);
    if (tab.id !== undefined) {
      await showAuthorizationFeedback(tab.id, response);
    }
  });
});
