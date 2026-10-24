// SPDX-License-Identifier: Apache-2.0

import type { SerializedFinding, SerializedRunResult } from "../run/run-controller.js";

export type MarkdownReportInput = {
  readonly page: { readonly origin: string; readonly pathname: string };
  readonly result: SerializedRunResult;
  readonly state: "current" | "previous";
};

// Keep page-derived strings on one Markdown line, without HTML or link syntax.
const text = (value: string): string => value
  .replace(/&/gu, "&amp;")
  .replace(/</gu, "&lt;")
  .replace(/>/gu, "&gt;")
  .replace(/[\\`*_[\]{}()#+.!|~:-]/gu, "\\$&")
  .replace(/\p{Cc}/gu, (character) => `&#${character.charCodeAt(0)};`);

const px = (value: number): string => `${value}px`;
const scenarioNames = {
  "large-text": "Large Text",
  "long-text": "Long Text",
  "unbreakable-text": "Unbreakable Text",
} as const;
const detectorNames = {
  "text-clipping": "Text Clipping",
  "horizontal-containment-overflow": "Horizontal Containment Overflow",
  "viewport-overflow": "Viewport Overflow",
} as const;

type TextFinding = Extract<SerializedFinding, { detectorId: "text-clipping" }>;

function rangeEvidence(range: TextFinding["affectedRange"], label: string): string[] {
  const rectangles = (rects: typeof range.baselineRects): string => rects.length === 0
    ? "none"
    : rects.map((rect) =>
      `left ${px(rect.left)}, top ${px(rect.top)}, right ${px(rect.right)}, bottom ${px(rect.bottom)}, width ${px(rect.width)}, height ${px(rect.height)}`
    ).join("; ");
  return [
    `- ${label}: ${text(range.locator)}`,
    `- Redacted preview: ${text(range.preview)}`,
    `- Baseline range rectangles: ${rectangles(range.baselineRects)}`,
    `- Mutated range rectangles: ${rectangles(range.mutatedRects)}`,
  ];
}

function findingEvidence(finding: SerializedFinding): string[] {
  switch (finding.detectorId) {
    case "text-clipping":
      return [
        `- Clipped axis: ${finding.clippedAxis}`,
        `- Baseline visible extent: ${px(finding.baseline.visibleExtent)}`,
        `- Mutated hidden extent: ${px(finding.mutated.hiddenExtent)}`,
        `- Text Owner: ${text(finding.textOwner.locator)}`,
        `- Computed CSS: overflow-x ${text(finding.computedStyles.overflowX)}; overflow-y ${text(finding.computedStyles.overflowY)}; white-space ${text(finding.computedStyles.whiteSpace)}`,
        ...rangeEvidence(finding.affectedRange, "Primary affected range"),
        ...finding.affectedRanges.flatMap((range, index) => rangeEvidence(range, `Affected range ${index + 1}`)),
      ];
    case "horizontal-containment-overflow":
      return [
        `- Overflow side: ${finding.overflowSide}`,
        `- Baseline maximum excess: ${px(finding.baseline.maximumExcess)}`,
        `- Mutated maximum excess: ${px(finding.mutated.maximumExcess)}`,
        `- Affected elements: ${finding.affectedElementCount}`,
        ...finding.overflowingElements.map((element) =>
          `- Affected element: ${text(element.locator)}; side ${element.overflowSide}; baseline excess ${px(element.baseline.excess)}; mutated excess ${px(element.mutated.excess)}; delta ${px(element.measuredDelta)}`
        ),
      ];
    case "viewport-overflow":
      return [
        "- Finding Subject: Target Page",
        `- Contribution side: ${finding.contributionSide}`,
        `- Baseline: document extent ${px(finding.baseline.documentExtent)}; viewport width ${px(finding.baseline.viewportWidth)}; excess ${px(finding.baseline.excess)}`,
        `- Mutated: document extent ${px(finding.mutated.documentExtent)}; viewport width ${px(finding.mutated.viewportWidth)}; excess ${px(finding.mutated.excess)}`,
        `- Primary Contributor: ${text(finding.primaryContributor.locator)}; contribution ${px(finding.primaryContributor.contribution)}`,
        `- Primary Contributor geometry: baseline left ${px(finding.primaryContributor.baseline.left)}, right ${px(finding.primaryContributor.baseline.right)}; mutated left ${px(finding.primaryContributor.mutated.left)}, right ${px(finding.primaryContributor.mutated.right)}`,
        ...finding.contributors.map((contributor) =>
          `- Contributor: ${text(contributor.locator)}; side ${contributor.contributionSide}; baseline excess ${px(contributor.baseline.excess)}; mutated excess ${px(contributor.mutated.excess)}; delta ${px(contributor.measuredDelta)}; contribution ${px(contributor.contribution)}`
        ),
      ];
  }
}

/** Formats only serialized report data, preserving detector-specific Finding order. */
export function formatMarkdownReport({ page, result, state }: MarkdownReportInput): string {
  const coverage = result.coverage;
  const lines = [
    "# UI Torture Lab — Markdown Report",
    "",
    `- Scenario: ${scenarioNames[result.scenarioId]}`,
    `- Run status: ${result.status}`,
    `- Lifecycle: ${state === "previous" ? "Previous-Target Snapshot" : "Current Run Result"}`,
    `- Page origin: ${text(page.origin)}`,
    `- Page path: ${text(page.pathname)}`,
    `- Restore status: ${result.restore.status}`,
    `- Reload required: ${result.restore.status === "restored" ? "no" : "yes"}`,
    ...(result.terminationReason !== undefined ? [`- Termination reason: ${text(result.terminationReason)}`] : []),
    "",
    text(result.summary),
    "",
    "## Coverage",
    "",
    `- Eligible targets: ${coverage.eligibleTargets}`,
    `- Mutated targets: ${coverage.mutatedTargets}`,
    `- Excluded targets: ${coverage.excludedTargets}`,
    `- Skipped targets: ${coverage.skippedTargets}`,
    `- Safe-failed targets: ${coverage.safeFailedTargets}`,
    `- Ineffective targets: ${coverage.ineffectiveTargets}`,
    `- Comparable targets: ${coverage.comparableTargets}`,
    `- Inconclusive targets: ${coverage.inconclusiveTargets}`,
    `- Contributor targets: ${coverage.contributorTargets}`,
    `- Findings: ${coverage.findingCount}`,
    "",
    "## Findings",
    "",
  ];
  if (result.findings.length === 0) lines.push("No Findings were produced.", "");
  for (const detectorId of ["text-clipping", "horizontal-containment-overflow", "viewport-overflow"] as const) {
    const findings = result.findings.filter((finding) => finding.detectorId === detectorId);
    if (findings.length === 0) continue;
    lines.push(`### ${detectorNames[detectorId]}`, "");
    for (const [index, finding] of findings.entries()) {
      lines.push(
        `#### Finding ${index + 1}`,
        "",
        `- Diagnostic locator: ${text(finding.locator)}`,
        `- Scenario: ${scenarioNames[finding.scenarioId]}`,
        `- Measured Delta: ${px(finding.measuredDelta)}`,
        ...findingEvidence(finding),
        `- Possible Cause (hypothesis): ${text(finding.possibleCause)}`,
        "",
      );
    }
  }
  lines.push("## Restore", "", `- Status: ${result.restore.status}`);
  if (result.restore.conflicts.length === 0) lines.push("- Conflicts: none");
  for (const conflict of result.restore.conflicts) {
    lines.push(`- Conflict: ${text(conflict.kind)}; reason ${text(conflict.reason)}`);
  }
  lines.push("", "## Inconclusive reasons", "");
  lines.push(...(result.inconclusiveReasons.length === 0
    ? ["None recorded."]
    : result.inconclusiveReasons.map((reason) => `- ${text(reason)}`)));
  lines.push(
    "",
    "## Limitations",
    "",
    "Only the serialized, redacted result is included. Coverage is limited to the supported top-level light DOM and the selected Scenario. No Findings does not establish that the page has no layout problems. Possible Cause is a hypothesis.",
    ...(state === "previous" ? ["This Previous-Target Snapshot has no live DOM actions; elements are not rematched."] : []),
    ...(result.restore.status !== "restored" ? ["Reload required before another Run. External changes were left untouched; Restore was not fully verified."] : []),
    "",
  );
  return lines.join("\n");
}
