// SPDX-License-Identifier: Apache-2.0

import type { SerializedRunResult } from "@ui-torture-lab/engine";

export const tabSessionStorageKey = (tabId: number): string =>
  `ui-torture-lab:tab-session:${tabId}`;

export const runResultStorageKey = (sessionId: string): string =>
  `ui-torture-lab:current-run-result:${sessionId}`;

export type TabSession = {
  readonly documentId: string | null;
  readonly id: string;
};

export type PageMetadata = {
  readonly origin: string;
  readonly pathname: string;
};

export type StoredRunResult = {
  readonly documentId: string;
  readonly page: PageMetadata;
  readonly result: SerializedRunResult;
  readonly state: "current" | "previous";
  readonly tabSessionId: string;
};

export const pageMetadataFor = (location: Location): PageMetadata => ({
  origin: location.origin,
  pathname: location.pathname,
});

export const isPageMetadata = (value: unknown): value is PageMetadata =>
  isRecord(value) &&
  hasExactKeys(value, ["origin", "pathname"]) &&
  typeof value.origin === "string" &&
  typeof value.pathname === "string" &&
  isSafePageLocation(value.origin, value.pathname);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean => {
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  return actual.length === keys.length && keys.every((key, index) => actual[index] === key);
};

const sensitiveText = /\b(?:api[-_ ]?key|authorization|bearer|pass(?:word)?|secret|token)\b\s*(?:=|:|\s)\s*[^\s,;]+/iu;
const isString = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 512 && !sensitiveText.test(value);
const isPreview = (value: unknown): value is string =>
  isString(value) && value.length <= 48;
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(isString);
const isScenarioId = (value: unknown): boolean =>
  value === "large-text" || value === "long-text" || value === "unbreakable-text";
const isSide = (value: unknown): boolean =>
  value === "inline-start" || value === "inline-end" || value === "both";
const isRect = (value: unknown): boolean =>
  isRecord(value) &&
  hasExactKeys(value, ["bottom", "height", "left", "right", "top", "width"]) &&
  Object.values(value).every(isFiniteNumber);
const isElementGeometry = (value: unknown): boolean =>
  isRecord(value) && hasExactKeys(value, ["left", "right"]) &&
  isFiniteNumber(value.left) && isFiniteNumber(value.right);
const isRangeEvidence = (value: unknown): boolean =>
  isRecord(value) &&
  hasExactKeys(value, ["baselineRects", "locator", "mutatedRects", "preview"]) &&
  Array.isArray(value.baselineRects) && value.baselineRects.every(isRect) &&
  isString(value.locator) &&
  Array.isArray(value.mutatedRects) && value.mutatedRects.every(isRect) &&
  isPreview(value.preview);

const isTextClippingFinding = (value: Record<string, unknown>): boolean =>
  hasExactKeys(value, [
    "affectedRange", "affectedRanges", "baseline", "clippedAxis", "computedStyles",
    "detectorId", "locator", "measuredDelta", "mutated", "possibleCause", "scenarioId", "textOwner",
  ]) &&
  value.detectorId === "text-clipping" &&
  isRangeEvidence(value.affectedRange) &&
  Array.isArray(value.affectedRanges) && value.affectedRanges.every(isRangeEvidence) &&
  isRecord(value.baseline) && hasExactKeys(value.baseline, ["visibleExtent"]) && isFiniteNumber(value.baseline.visibleExtent) &&
  (value.clippedAxis === "horizontal" || value.clippedAxis === "vertical") &&
  isRecord(value.computedStyles) &&
  hasExactKeys(value.computedStyles, ["overflowX", "overflowY", "whiteSpace"]) &&
  Object.values(value.computedStyles).every(isString) &&
  isString(value.locator) && isFiniteNumber(value.measuredDelta) &&
  isRecord(value.mutated) && hasExactKeys(value.mutated, ["hiddenExtent"]) && isFiniteNumber(value.mutated.hiddenExtent) &&
  isString(value.possibleCause) && isScenarioId(value.scenarioId) &&
  isRecord(value.textOwner) && hasExactKeys(value.textOwner, ["locator"]) && isString(value.textOwner.locator);

const isHorizontalFinding = (value: Record<string, unknown>): boolean =>
  hasExactKeys(value, [
    "affectedElementCount", "baseline", "detectorId", "locator", "measuredDelta", "mutated",
    "overflowSide", "overflowingElements", "possibleCause", "scenarioId",
  ]) &&
  value.detectorId === "horizontal-containment-overflow" && isFiniteNumber(value.affectedElementCount) &&
  isRecord(value.baseline) && hasExactKeys(value.baseline, ["maximumExcess"]) && isFiniteNumber(value.baseline.maximumExcess) &&
  isString(value.locator) && isFiniteNumber(value.measuredDelta) &&
  isRecord(value.mutated) && hasExactKeys(value.mutated, ["maximumExcess"]) && isFiniteNumber(value.mutated.maximumExcess) &&
  isSide(value.overflowSide) && isString(value.possibleCause) && isScenarioId(value.scenarioId) &&
  Array.isArray(value.overflowingElements) && value.overflowingElements.every((element) =>
    isRecord(element) && hasExactKeys(element, ["baseline", "locator", "measuredDelta", "mutated", "overflowSide"]) &&
    isRecord(element.baseline) && hasExactKeys(element.baseline, ["excess"]) && isFiniteNumber(element.baseline.excess) &&
    isString(element.locator) && isFiniteNumber(element.measuredDelta) &&
    isRecord(element.mutated) && hasExactKeys(element.mutated, ["excess"]) && isFiniteNumber(element.mutated.excess) &&
    isSide(element.overflowSide),
  );

const isViewportGeometry = (value: unknown): boolean =>
  isRecord(value) &&
  hasExactKeys(value, ["documentExtent", "excess", "viewportWidth"]) &&
  Object.values(value).every(isFiniteNumber);

const isViewportFinding = (value: Record<string, unknown>): boolean =>
  hasExactKeys(value, [
    "baseline", "contributionSide", "contributors", "detectorId", "locator", "measuredDelta",
    "mutated", "possibleCause", "primaryContributor", "scenarioId",
  ]) &&
  value.detectorId === "viewport-overflow" && isViewportGeometry(value.baseline) &&
  isSide(value.contributionSide) && value.locator === "target-page" && isFiniteNumber(value.measuredDelta) &&
  isViewportGeometry(value.mutated) && isString(value.possibleCause) && isScenarioId(value.scenarioId) &&
  Array.isArray(value.contributors) && value.contributors.every((contributor) =>
    isRecord(contributor) && hasExactKeys(contributor, ["baseline", "contribution", "contributionSide", "locator", "measuredDelta", "mutated"]) &&
    isRecord(contributor.baseline) && hasExactKeys(contributor.baseline, ["excess"]) && isFiniteNumber(contributor.baseline.excess) &&
    isFiniteNumber(contributor.contribution) && isSide(contributor.contributionSide) && isString(contributor.locator) &&
    isFiniteNumber(contributor.measuredDelta) &&
    isRecord(contributor.mutated) && hasExactKeys(contributor.mutated, ["excess"]) && isFiniteNumber(contributor.mutated.excess),
  ) &&
  isRecord(value.primaryContributor) &&
  hasExactKeys(value.primaryContributor, ["baseline", "contribution", "locator", "mutated"]) &&
  isElementGeometry(value.primaryContributor.baseline) && isFiniteNumber(value.primaryContributor.contribution) &&
  isString(value.primaryContributor.locator) && isElementGeometry(value.primaryContributor.mutated);

const isCoverage = (value: unknown): boolean =>
  isRecord(value) &&
  hasExactKeys(value, [
    "comparableTargets", "contributorTargets", "excludedTargets", "findingCount", "eligibleTargets",
    "ineffectiveTargets", "inconclusiveTargets", "mutatedTargets", "safeFailedTargets", "skippedTargets",
  ]) &&
  Object.values(value).every(isFiniteNumber);

const isRestore = (value: unknown): boolean =>
  isRecord(value) && hasExactKeys(value, ["conflicts", "status"]) &&
  (value.status === "conflict" || value.status === "restored" || value.status === "unverified") &&
  Array.isArray(value.conflicts) && value.conflicts.every((conflict) =>
    isRecord(conflict) && hasExactKeys(conflict, ["kind", "reason"]) && isString(conflict.kind) &&
    (conflict.reason === "applied-state-changed" || conflict.reason === "restore-failed" ||
      conflict.reason === "restore-unverified" || conflict.reason === "target-disconnected" ||
      conflict.reason === "target-moved"),
  );

const isSafePageLocation = (origin: string, pathname: string): boolean => {
  try {
    const url = new URL(origin);
    return (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === origin && pathname.startsWith("/") && !/[?#]/u.test(pathname);
  } catch {
    return false;
  }
};

export const isSerializedRunResult = (
  value: unknown,
): value is SerializedRunResult =>
  isRecord(value) &&
  (value.status === "completed"
    ? hasExactKeys(value, ["coverage", "findings", "inconclusiveReasons", "restore", "scenarioId", "status", "summary"])
    : value.status === "aborted" &&
      hasExactKeys(value, ["coverage", "findings", "inconclusiveReasons", "restore", "scenarioId", "status", "summary", "terminationReason"]) &&
      value.terminationReason === "unknown-mutation-state") &&
  isScenarioId(value.scenarioId) && isCoverage(value.coverage) &&
  Array.isArray(value.findings) && value.findings.every((finding) =>
    isRecord(finding) && (isTextClippingFinding(finding) || isHorizontalFinding(finding) || isViewportFinding(finding)),
  ) &&
  isStringArray(value.inconclusiveReasons) && isRestore(value.restore) && isString(value.summary);

export const isStoredRunResult = (value: unknown): value is StoredRunResult =>
  isRecord(value) &&
  hasExactKeys(value, ["documentId", "page", "result", "state", "tabSessionId"]) &&
  isString(value.documentId) && value.documentId.length > 0 &&
  isPageMetadata(value.page) && isSerializedRunResult(value.result) &&
  isString(value.tabSessionId) && value.tabSessionId.length > 0 &&
  (value.state === "current" || value.state === "previous");
