// SPDX-License-Identifier: Apache-2.0

import type {
  SupportedTargetProtocol,
  TargetBootstrapResponse,
  TargetProbeResponse,
} from "./messages";

export function probeTargetPage(expectedUrl: string): TargetProbeResponse {
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

  return {
    type: responseType,
    status: "matched",
    protocol: protocol as SupportedTargetProtocol,
  };
}

export function bootstrapTargetPage(
  expectedUrl: string,
): TargetBootstrapResponse {
  const responseType = "target-bootstrap-response" as const;

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

  if (document.contentType !== "text/html") {
    return {
      type: responseType,
      status: "rejected",
      reason: "non-html-document",
    };
  }

  return {
    type: responseType,
    status: "bootstrapped",
    protocol: protocol as SupportedTargetProtocol,
    contentType: "text/html",
    topLevel: true,
  };
}
