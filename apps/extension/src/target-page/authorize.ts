// SPDX-License-Identifier: Apache-2.0

import { bootstrapTargetPage, probeTargetPage } from "./bootstrap";
import { browser, type Browser } from "wxt/browser";
import {
  authorizationResponseType,
  isTargetBootstrapResponse,
  isTargetProbeResponse,
  type TargetAuthorizationResponse,
  type TargetRejectionReason,
} from "./messages";

const protectedProtocols = new Set(["chrome:", "chrome-extension:", "devtools:"]);

const rejectionMessages: Readonly<Record<TargetRejectionReason, string>> = {
  "document-changed":
    "The page changed before authorization completed. Click the toolbar action again.",
  "injection-failed":
    "UI Torture Lab could not access this page. Click the toolbar action again.",
  "invalid-bootstrap-response":
    "UI Torture Lab could not verify the current document. Click the toolbar action again.",
  "missing-target": "UI Torture Lab could not identify the current tab.",
  "non-html-document":
    "This page is not supported. UI Torture Lab runs only on top-level HTML documents.",
  "not-top-level-document":
    "This page is not supported. UI Torture Lab runs only in the top-level document.",
  "protected-page": "This protected Chrome page cannot be analyzed.",
  "unsupported-protocol":
    "This page is not supported. UI Torture Lab runs only on HTTP or HTTPS HTML pages. Serve local files through localhost.",
};

const reject = (reason: TargetRejectionReason): TargetAuthorizationResponse => ({
  type: authorizationResponseType,
  status: "rejected",
  reason,
  message: rejectionMessages[reason],
});

const validateTargetUrl = (
  url: string | undefined,
): { readonly supported: true; readonly url: string } | TargetAuthorizationResponse => {
  if (url === undefined) {
    return reject("missing-target");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return reject("unsupported-protocol");
  }

  if (protectedProtocols.has(parsedUrl.protocol)) {
    return reject("protected-page");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return reject("unsupported-protocol");
  }

  return { supported: true, url: parsedUrl.href };
};

export async function authorizeTargetPage(
  tab: Pick<Browser.tabs.Tab, "id" | "url">,
): Promise<TargetAuthorizationResponse> {
  if (tab.id === undefined) {
    return reject("missing-target");
  }

  const target = validateTargetUrl(tab.url);
  if (!("supported" in target)) {
    return target;
  }

  let probeInjections: Browser.scripting.InjectionResult<unknown>[];
  try {
    probeInjections = await browser.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      world: "ISOLATED",
      injectImmediately: true,
      func: probeTargetPage,
      args: [target.url],
    });
  } catch {
    return reject("injection-failed");
  }

  const probeInjection = probeInjections[0];
  if (
    probeInjection === undefined ||
    probeInjection.frameId !== 0 ||
    typeof probeInjection.documentId !== "string" ||
    probeInjection.documentId.length === 0 ||
    !isTargetProbeResponse(probeInjection.result)
  ) {
    return reject("invalid-bootstrap-response");
  }

  if (probeInjection.result.status === "rejected") {
    return reject(probeInjection.result.reason);
  }

  let bootstrapInjections: Browser.scripting.InjectionResult<unknown>[];
  try {
    bootstrapInjections = await browser.scripting.executeScript({
      target: {
        tabId: tab.id,
        documentIds: [probeInjection.documentId],
      },
      world: "ISOLATED",
      injectImmediately: true,
      func: bootstrapTargetPage,
      args: [target.url],
    });
  } catch {
    return reject("document-changed");
  }

  const bootstrapInjection = bootstrapInjections[0];
  if (
    bootstrapInjection === undefined ||
    bootstrapInjection.frameId !== 0 ||
    bootstrapInjection.documentId !== probeInjection.documentId ||
    !isTargetBootstrapResponse(bootstrapInjection.result)
  ) {
    return reject("invalid-bootstrap-response");
  }

  if (bootstrapInjection.result.status === "rejected") {
    return reject(bootstrapInjection.result.reason);
  }

  return {
    type: authorizationResponseType,
    status: "authorized",
    documentId: bootstrapInjection.documentId,
    protocol: bootstrapInjection.result.protocol,
    contentType: bootstrapInjection.result.contentType,
    topLevel: bootstrapInjection.result.topLevel,
    executionWorld: "ISOLATED",
  };
}
