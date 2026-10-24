// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { formatMarkdownReport } from "../../packages/engine/dist/index.js";

const base = () => ({
  page: { origin: "https://fixture.test", pathname: "/sample/" },
  state: "current",
  result: {
    coverage: {
      eligibleTargets: 2, mutatedTargets: 1, excludedTargets: 3,
      skippedTargets: 1, safeFailedTargets: 0, ineffectiveTargets: 0,
      comparableTargets: 1, inconclusiveTargets: 0, contributorTargets: 0,
      findingCount: 0,
    },
    findings: [],
    inconclusiveReasons: [],
    restore: { conflicts: [], status: "restored" },
    scenarioId: "long-text",
    status: "completed",
    summary: "No supported Finding was produced.",
  },
});

const range = {
  baselineRects: [{ left: 1, top: 2, right: 31, bottom: 12, width: 30, height: 10 }],
  mutatedRects: [{ left: 1, top: 2, right: 61, bottom: 12, width: 60, height: 10 }],
  locator: "span#label",
  preview: "Public label",
};
const clipping = () => ({
  affectedRange: structuredClone(range),
  affectedRanges: [structuredClone(range)],
  baseline: { visibleExtent: 30 },
  clippedAxis: "horizontal",
  computedStyles: { overflowX: "hidden", overflowY: "clip", whiteSpace: "nowrap" },
  detectorId: "text-clipping",
  locator: "div#boundary",
  measuredDelta: 20.25,
  mutated: { hiddenExtent: 20.25 },
  possibleCause: "A fixed boundary may clip expanded text.",
  scenarioId: "long-text",
  textOwner: { locator: "span#label" },
});
const containment = () => ({
  affectedElementCount: 1,
  baseline: { maximumExcess: 2 },
  detectorId: "horizontal-containment-overflow",
  locator: "section#container",
  measuredDelta: 18.5,
  mutated: { maximumExcess: 20.5 },
  overflowSide: "inline-end",
  overflowingElements: [{
    baseline: { excess: 2 }, locator: "p#content", measuredDelta: 18.5,
    mutated: { excess: 20.5 }, overflowSide: "inline-end",
  }],
  possibleCause: "An unbreakable item may exceed its boundary.",
  scenarioId: "unbreakable-text",
});
const viewport = () => ({
  baseline: { documentExtent: 800, excess: 0, viewportWidth: 800 },
  contributionSide: "inline-end",
  contributors: [{
    baseline: { excess: 0 }, contribution: 20.5, contributionSide: "inline-end",
    locator: "p#content", measuredDelta: 20.5, mutated: { excess: 20.5 },
  }],
  detectorId: "viewport-overflow",
  locator: "target-page",
  measuredDelta: 20.5,
  mutated: { documentExtent: 820.5, excess: 20.5, viewportWidth: 800 },
  possibleCause: "A contributor may widen the document.",
  primaryContributor: {
    baseline: { left: 10, right: 800 }, contribution: 20.5, locator: "p#content",
    mutated: { left: 10, right: 820.5 },
  },
  scenarioId: "unbreakable-text",
});

const golden = (name) => readFile(new URL(`./goldens/markdown-${name}.md`, import.meta.url), "utf8");
const freeze = (value) => {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

test("zero-Finding report is deterministic from frozen serialized data in Node", async () => {
  const input = freeze(base());
  const expected = await golden("zero");
  assert.equal(formatMarkdownReport(input), expected);
  assert.equal(formatMarkdownReport(JSON.parse(JSON.stringify(input))), expected);
});

test("aborted Run golden includes termination and no Findings", async () => {
  const input = base();
  input.result.status = "aborted";
  input.result.terminationReason = "unknown-mutation-state";
  input.result.summary = "Run aborted; applied values were restored.";
  assert.equal(formatMarkdownReport(input), await golden("aborted"));
});

test("Restore conflict and reload-required golden preserves all conflict reasons", async () => {
  const input = base();
  input.result.restore = {
    status: "conflict",
    conflicts: [
      { kind: "text", reason: "applied-state-changed" },
      { kind: "style", reason: "target-disconnected" },
    ],
  };
  input.result.summary = "External changes were left untouched. Reload required.";
  input.result.inconclusiveReasons = ["A comparison was unstable."];
  input.result.coverage.inconclusiveTargets = 1;
  assert.equal(formatMarkdownReport(input), await golden("conflict"));
});

test("unverified aborted Run golden remains exportable with cleanup failures", async () => {
  const input = base();
  input.result.status = "aborted";
  input.result.terminationReason = "unknown-mutation-state";
  input.result.restore = {
    status: "unverified", conflicts: [{ kind: "style", reason: "restore-unverified" }],
  };
  input.result.summary = "Run aborted; cleanup was incomplete. Reload required.";
  assert.equal(formatMarkdownReport(input), await golden("unverified"));
});

test("Previous-Target Snapshot golden contains serialized metadata without live actions", async () => {
  const input = base();
  input.state = "previous";
  assert.equal(formatMarkdownReport(input), await golden("previous"));
});

test("all Detector goldens retain Evidence, units, contributors and detector-specific order", async () => {
  const input = base();
  input.result.scenarioId = "unbreakable-text";
  input.result.findings = [viewport(), containment(), { ...clipping(), scenarioId: "unbreakable-text" }, { ...clipping(), scenarioId: "unbreakable-text", locator: "div#second", measuredDelta: 10 }];
  input.result.coverage.findingCount = 4;
  input.result.coverage.contributorTargets = 1;
  input.result.summary = "Supported regressions were measured.";
  assert.equal(formatMarkdownReport(freeze(input)), await golden("findings"));
});

test("Unicode and hostile Markdown golden stays literal without HTML, links or injected headings", async () => {
  const input = base();
  input.page.pathname = "/caffè/東京/";
  input.result.scenarioId = "large-text";
  const finding = { ...clipping(), scenarioId: "large-text" };
  const hostile = "`[x](https://evil.test) <img> & **bold**\n# Heading\r\n| cell | \\ 😺";
  finding.locator = hostile;
  finding.possibleCause = hostile;
  finding.affectedRange = { ...range, baselineRects: [], mutatedRects: [], preview: "Caffè 東京 😺 <b>&`[redacted]" };
  finding.affectedRanges = [];
  input.result.findings = [finding];
  input.result.coverage.findingCount = 1;
  input.result.summary = "Caffè 東京 😺";
  assert.equal(formatMarkdownReport(input), await golden("unicode"));
});

test("large report matches a repeated golden block without truncating or reordering Findings", async () => {
  const input = base();
  input.result.findings = Array.from({ length: 1000 }, () => clipping());
  input.result.coverage.findingCount = 1000;
  input.result.summary = "Supported regressions were measured.";
  const template = await golden("large-template");
  const [header, block, footer] = template.split("<!-- finding block -->\n");
  const expected = header + Array.from({ length: 1000 }, (_, index) =>
    block.replace("#### Finding 1", `#### Finding ${index + 1}`)
  ).join("") + footer;
  assert.equal(formatMarkdownReport(freeze(input)), expected);
});

test("formatter omits unknown fields and never serializes hidden operational data", () => {
  const input = base();
  input.result.findings = [clipping()];
  const expected = formatMarkdownReport(input);
  input.documentId = "private-document-id";
  input.tabSessionId = "private-session-id";
  input.page.query = "?secret=private";
  input.result.mutationJournal = "private original text";
  input.result.findings[0].password = "private credential";
  input.result.findings[0].affectedRange.baselineRects[0].hiddenValue = "private source";
  assert.equal(formatMarkdownReport(input), expected);
});
