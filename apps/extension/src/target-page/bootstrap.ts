// SPDX-License-Identifier: Apache-2.0

import type { PageAuthorizationAttempt } from "./page-authorization";

import type {
  SupportedTargetProtocol,
  TargetBootstrapResponse,
  TargetProbeResponse,
} from "./messages";

export function probeTargetPage(expectedUrl: string, attemptId: string): TargetProbeResponse {
  const responseType = "target-probe-response" as const;

  if (window.top !== window) {
    return {
      type: responseType,
      status: "rejected",
      reason: "not-top-level-document",
    };
  }

  const protocol = window.location.protocol;
  if (protocol !== "http:" && protocol !== "https:") {
    return {
      type: responseType,
      status: "rejected",
      reason: "unsupported-protocol",
    };
  }

  if (window.location.href !== expectedUrl) {
    return {
      type: responseType,
      status: "rejected",
      reason: "document-changed",
    };
  }

  // This serialized function must install the attempt guard before any later injection or await.
  const key = Symbol.for("ui-torture-lab/page-authorization-attempt");
  const scope = globalThis as typeof globalThis & { [key: symbol]: PageAuthorizationAttempt | undefined };
  const previous = scope[key];
  previous?.stop();
  const navigation = window.navigation;
  const complete = navigation !== undefined && navigation.currentEntry !== null;
  const attempt: PageAuthorizationAttempt = {
    id: attemptId, expectedUrl, valid: true,
    stop() {
      attempt.valid = false;
      attempt.expectedUrl = "";
      if (scope[key] === attempt) delete scope[key];
      if (complete) navigation.removeEventListener("currententrychange", invalidate);
      else { window.removeEventListener("popstate", invalidate); window.removeEventListener("hashchange", invalidate); }
      window.removeEventListener("pagehide", invalidate);
    },
  };
  const invalidate = (): void => { attempt.valid = false; attempt.stop(); };
  scope[key] = attempt;
  if (complete) navigation.addEventListener("currententrychange", invalidate);
  else { window.addEventListener("popstate", invalidate); window.addEventListener("hashchange", invalidate); }
  window.addEventListener("pagehide", invalidate);

  return {
    type: responseType,
    status: "matched",
    protocol: protocol as SupportedTargetProtocol,
  };
}

export function bootstrapTargetPage(
  expectedUrl: string,
  attemptId: string,
): TargetBootstrapResponse {
  const responseType = "target-bootstrap-response" as const;
  const attempt = (globalThis as typeof globalThis & { [key: symbol]: PageAuthorizationAttempt | undefined })[
    Symbol.for("ui-torture-lab/page-authorization-attempt")
  ];
  const reject = (reason: Extract<TargetBootstrapResponse, { status: "rejected" }>["reason"]): TargetBootstrapResponse => {
    if (attempt?.id === attemptId) attempt.stop();
    return { type: responseType, status: "rejected", reason };
  };
  if (window.top !== window) return reject("not-top-level-document");
  const protocol = window.location.protocol;
  if (protocol !== "http:" && protocol !== "https:") return reject("unsupported-protocol");
  if (window.location.href !== expectedUrl || attempt?.id !== attemptId || !attempt.valid) return reject("document-changed");
  if (document.contentType !== "text/html") return reject("non-html-document");
  const runtime = (globalThis as typeof globalThis & {
    [key: symbol]: { document: Document; isExtensionOwnedNode(node: Node): boolean } | undefined;
  })[Symbol.for("ui-torture-lab/document-runtime")];
  // Markers cannot prove ownership. An unverified surface blocks admission; it is never removed.
  for (const host of document.querySelectorAll("ui-torture-lab-runtime,ui-torture-lab-root,ui-torture-lab-overlay-root,[data-ui-torture-lab-root],[data-ui-torture-lab-overlay-root]")) {
    if (runtime?.document !== document || typeof runtime.isExtensionOwnedNode !== "function" || !runtime.isExtensionOwnedNode(host)) {
      return reject("unverified-control-surface");
    }
  }
  return { type: responseType, status: "bootstrapped", protocol: protocol as SupportedTargetProtocol, contentType: "text/html", topLevel: true };
}

/** Serialized cancellation is scoped to the exact attempt, even if the current Document changed. */
export function cancelPageAuthorizationAttempt(attemptId: string): void {
  const attempt = (globalThis as typeof globalThis & { [key: symbol]: PageAuthorizationAttempt | undefined })[
    Symbol.for("ui-torture-lab/page-authorization-attempt")
  ];
  if (attempt?.id === attemptId) attempt.stop();
}
