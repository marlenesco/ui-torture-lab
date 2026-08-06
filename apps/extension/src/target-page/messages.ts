// SPDX-License-Identifier: Apache-2.0

export const bootstrapResponseType = "target-bootstrap-response" as const;
export const probeResponseType = "target-probe-response" as const;
export const authorizationResponseType = "target-authorization-response" as const;

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
