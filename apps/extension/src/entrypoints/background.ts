// SPDX-License-Identifier: Apache-2.0

import "@ui-torture-lab/engine";
import { browser } from "wxt/browser";
import {
  authorizeTargetPage,
  rejectTargetAuthorization,
} from "../target-page/authorize";
import { mountTargetPageControlShell } from "../target-page/control-shell";
import { showAuthorizationFeedback } from "../target-page/feedback";

export default defineBackground(() => {
  browser.action.onClicked.addListener(async (tab) => {
    let response = await authorizeTargetPage(tab);
    if (
      response.status === "authorized" &&
      tab.id !== undefined &&
      !(await mountTargetPageControlShell(tab.id, response.documentId))
    ) {
      response = rejectTargetAuthorization("ui-mount-failed");
    }
    if (tab.id !== undefined) {
      await showAuthorizationFeedback(tab.id, response);
    }
  });
});
