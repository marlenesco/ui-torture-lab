// SPDX-License-Identifier: Apache-2.0

import "@ui-torture-lab/engine";
import { browser } from "wxt/browser";
import {
  authorizeTargetPage,
  rejectTargetAuthorization,
} from "../target-page/authorize";
import { mountTargetPageControlShell } from "../target-page/control-shell";
import { showAuthorizationFeedback, showRunActivity } from "../target-page/feedback";
import { isRunActivityMessage } from "../target-page/messages";

const authorizedDocumentIdsStorageKey = "authorized-document-ids";

type AuthorizedDocumentIds = Record<string, string>;

const readAuthorizedDocumentId = async (tabId: number): Promise<string | null> => {
  const stored = await browser.storage.session.get(authorizedDocumentIdsStorageKey);
  const documentIds = stored[authorizedDocumentIdsStorageKey];
  if (typeof documentIds !== "object" || documentIds === null) return null;
  const documentId = (documentIds as AuthorizedDocumentIds)[String(tabId)];
  return typeof documentId === "string" ? documentId : null;
};

const writeAuthorizedDocumentId = async (
  tabId: number,
  documentId: string | null,
): Promise<void> => {
  const stored = await browser.storage.session.get(authorizedDocumentIdsStorageKey);
  const documentIds = stored[authorizedDocumentIdsStorageKey];
  const next: AuthorizedDocumentIds =
    typeof documentIds === "object" && documentIds !== null
      ? { ...(documentIds as AuthorizedDocumentIds) }
      : {};
  if (documentId === null) {
    delete next[String(tabId)];
  } else {
    next[String(tabId)] = documentId;
  }
  await browser.storage.session.set({ [authorizedDocumentIdsStorageKey]: next });
};

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender) => {
    if (
      !isRunActivityMessage(message) ||
      sender.tab?.id === undefined ||
      sender.frameId !== 0 ||
      sender.documentId === undefined
    ) {
      return;
    }
    const tabId = sender.tab.id;
    void readAuthorizedDocumentId(tabId).then((authorizedDocumentId) => {
      if (authorizedDocumentId !== sender.documentId) return;
      return showRunActivity(tabId, message.active);
    });
  });

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
      await writeAuthorizedDocumentId(
        tab.id,
        response.status === "authorized" ? response.documentId : null,
      );
      await showAuthorizationFeedback(tab.id, response);
    }
  });
});
