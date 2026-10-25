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
export const storePreviousRunResultMessageType = "store-previous-run-result" as const;
export const readRunResultMessageType = "read-current-run-result" as const;
export const clearRunResultMessageType = "clear-current-run-result" as const;
export const invalidateGrantMessageType = "invalidate-page-grant" as const;
export const runtimePortName = "ui-torture-lab/document-reachability";
export const bindGrantMessageType = "bind-page-grant" as const;
export const unreachableMessageType = "runtime-unreachable" as const;

export type BindGrantMessage = {
  readonly type: typeof bindGrantMessageType;
  readonly grantId: string;
  readonly active: boolean;
};

export const isBindGrantMessage = (value: unknown): value is BindGrantMessage =>
  isRecord(value) && hasExactKeys(value, ["active", "grantId", "type"]) &&
  value.type === bindGrantMessageType && isGrantId(value.grantId) && typeof value.active === "boolean";

export const isUnreachableMessage = (value: unknown): value is { type: typeof unreachableMessageType; grantId: string } =>
  isRecord(value) && hasExactKeys(value, ["grantId", "type"]) && value.type === unreachableMessageType && isGrantId(value.grantId);

export type InvalidateGrantMessage = {
  readonly type: typeof invalidateGrantMessageType;
  readonly grantId: string;
  readonly page: import("./current-run-result").PageMetadata;
  readonly result: import("@ui-torture-lab/engine").SerializedRunResult | null;
};

export type RunActivityMessage = {
  readonly grantId: string;
  readonly active: boolean;
  readonly type: typeof runActivityMessageType;
};

export type StoreRunResultMessage = {
  readonly grantId: string;
  readonly page: import("./current-run-result").PageMetadata;
  readonly result: import("@ui-torture-lab/engine").SerializedRunResult;
  readonly type: typeof storeRunResultMessageType | typeof storePreviousRunResultMessageType;
};

export type ReadRunResultMessage = { readonly type: typeof readRunResultMessageType; readonly grantId: string };

export type ClearRunResultMessage = { readonly type: typeof clearRunResultMessageType; readonly grantId: string };

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
  | "unverified-control-surface"
  | "reload-required"
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
  hasExactKeys(value, ["active", "grantId", "type"]) && isGrantId(value.grantId) &&
  value.type === runActivityMessageType &&
  typeof value.active === "boolean";

export const isStoreRunResultMessage = (
  value: unknown,
): value is StoreRunResultMessage =>
  isRecord(value) &&
  hasExactKeys(value, ["grantId", "page", "result", "type"]) && isGrantId(value.grantId) &&
  (value.type === storeRunResultMessageType || value.type === storePreviousRunResultMessageType) &&
  isPageMetadata(value.page) &&
  isSerializedRunResult(value.result);

export const isReadRunResultMessage = (
  value: unknown,
): value is ReadRunResultMessage =>
  isRecord(value) &&
  hasExactKeys(value, ["grantId", "type"]) && isGrantId(value.grantId) &&
  value.type === readRunResultMessageType;

export const isClearRunResultMessage = (
  value: unknown,
): value is ClearRunResultMessage =>
  isRecord(value) &&
  hasExactKeys(value, ["grantId", "type"]) && isGrantId(value.grantId) &&
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
      value.reason === "unverified-control-surface" ||
      value.reason === "not-top-level-document" ||
      value.reason === "unsupported-protocol")
  );
};

const isGrantId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128;

export const isInvalidateGrantMessage = (value: unknown): value is InvalidateGrantMessage =>
  isRecord(value) && hasExactKeys(value, ["grantId", "page", "result", "type"]) &&
  value.type === invalidateGrantMessageType && isGrantId(value.grantId) &&
  isPageMetadata(value.page) && (value.result === null || isSerializedRunResult(value.result));
