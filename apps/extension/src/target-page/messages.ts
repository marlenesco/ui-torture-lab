// SPDX-License-Identifier: Apache-2.0

import {
  isPageMetadata,
  isSerializedRunResult,
} from "./current-run-result";

export const bootstrapResponseType = "target-bootstrap-response" as const;
export const probeResponseType = "target-probe-response" as const;
export const authorizationResponseType = "target-authorization-response" as const;
export const runActivityMessageType = "run-activity-changed" as const;
export const storeRunResultMessageType = "store-current-run-result" as const;
export const readRunResultMessageType = "read-current-run-result" as const;
export const clearRunResultMessageType = "clear-current-run-result" as const;

export type RunActivityMessage = {
  readonly active: boolean;
  readonly type: typeof runActivityMessageType;
};

export type StoreRunResultMessage = {
  readonly page: import("./current-run-result").PageMetadata;
  readonly result: import("@ui-torture-lab/engine").SerializedRunResult;
  readonly type: typeof storeRunResultMessageType;
};

export type ReadRunResultMessage = { readonly type: typeof readRunResultMessageType };

export type ClearRunResultMessage = { readonly type: typeof clearRunResultMessageType };

export type SupportedTargetProtocol = "http:" | "https:";

export type TargetRejectionReason =
  | "document-changed"
  | "injection-failed"
  | "invalid-bootstrap-response"
  | "missing-target"
  | "non-html-document"
  | "not-top-level-document"
  | "protected-page"
  | "ui-mount-failed"
  | "unsupported-protocol";

export type TargetBootstrapResponse =
  | {
      readonly type: typeof bootstrapResponseType;
      readonly status: "bootstrapped";
      readonly protocol: SupportedTargetProtocol;
      readonly contentType: "text/html";
      readonly topLevel: true;
    }
  | {
      readonly type: typeof bootstrapResponseType;
      readonly status: "rejected";
      readonly reason: Exclude<
        TargetRejectionReason,
        | "injection-failed"
        | "invalid-bootstrap-response"
        | "missing-target"
        | "protected-page"
      >;
    };

export type TargetProbeResponse =
  | {
      readonly type: typeof probeResponseType;
      readonly status: "matched";
      readonly protocol: SupportedTargetProtocol;
    }
  | {
      readonly type: typeof probeResponseType;
      readonly status: "rejected";
      readonly reason:
        | "document-changed"
        | "not-top-level-document"
        | "unsupported-protocol";
    };

export type TargetAuthorizationResponse =
  | {
      readonly type: typeof authorizationResponseType;
      readonly status: "authorized";
      readonly documentId: string;
      readonly protocol: SupportedTargetProtocol;
      readonly contentType: "text/html";
      readonly topLevel: true;
      readonly executionWorld: "ISOLATED";
    }
  | {
      readonly type: typeof authorizationResponseType;
      readonly status: "rejected";
      readonly reason: TargetRejectionReason;
      readonly message: string;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isRunActivityMessage = (
  value: unknown,
): value is RunActivityMessage =>
  isRecord(value) &&
  hasExactKeys(value, ["active", "type"]) &&
  value.type === runActivityMessageType &&
  typeof value.active === "boolean";

export const isStoreRunResultMessage = (
  value: unknown,
): value is StoreRunResultMessage =>
  isRecord(value) &&
  hasExactKeys(value, ["page", "result", "type"]) &&
  value.type === storeRunResultMessageType &&
  isPageMetadata(value.page) &&
  isSerializedRunResult(value.result);

export const isReadRunResultMessage = (
  value: unknown,
): value is ReadRunResultMessage =>
  isRecord(value) &&
  hasExactKeys(value, ["type"]) &&
  value.type === readRunResultMessageType;

export const isClearRunResultMessage = (
  value: unknown,
): value is ClearRunResultMessage =>
  isRecord(value) &&
  hasExactKeys(value, ["type"]) &&
  value.type === clearRunResultMessageType;

const hasExactKeys = (
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean => {
  const actualKeys = Object.keys(value).sort();
  const normalizedExpectedKeys = [...expectedKeys].sort();
  return (
    actualKeys.length === normalizedExpectedKeys.length &&
    normalizedExpectedKeys.every((key, index) => actualKeys[index] === key)
  );
};

export const isTargetProbeResponse = (
  value: unknown,
): value is TargetProbeResponse => {
  if (!isRecord(value) || value.type !== probeResponseType) {
    return false;
  }

  if (value.status === "matched") {
    return (
      hasExactKeys(value, ["protocol", "status", "type"]) &&
      (value.protocol === "http:" || value.protocol === "https:")
    );
  }

  return (
    value.status === "rejected" &&
    hasExactKeys(value, ["reason", "status", "type"]) &&
    (value.reason === "document-changed" ||
      value.reason === "not-top-level-document" ||
      value.reason === "unsupported-protocol")
  );
};

export const isTargetBootstrapResponse = (
  value: unknown,
): value is TargetBootstrapResponse => {
  if (!isRecord(value) || value.type !== bootstrapResponseType) {
    return false;
  }

  if (value.status === "bootstrapped") {
    return (
      hasExactKeys(value, [
        "contentType",
        "protocol",
        "status",
        "topLevel",
        "type",
      ]) &&
      (value.protocol === "http:" || value.protocol === "https:") &&
      value.contentType === "text/html" &&
      value.topLevel === true
    );
  }

  return (
    value.status === "rejected" &&
    hasExactKeys(value, ["reason", "status", "type"]) &&
    (value.reason === "document-changed" ||
      value.reason === "non-html-document" ||
      value.reason === "not-top-level-document" ||
      value.reason === "unsupported-protocol")
  );
};
