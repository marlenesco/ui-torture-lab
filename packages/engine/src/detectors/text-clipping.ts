// SPDX-License-Identifier: Apache-2.0

import type { ScenarioId } from "../run/run-controller.js";
import { nextMeasurementFrame } from "./measurement-window.js";

type SupportingRange = {
  readonly baselineRects: readonly RangeRect[];
  readonly locator: string;
  readonly mutatedRects: readonly RangeRect[];
  readonly preview: string;
};

type RangeRect = {
  readonly bottom: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly width: number;
};

export type SerializedTextClippingFinding = {
  readonly affectedRange: SupportingRange;
  readonly affectedRanges: readonly SupportingRange[];
  readonly baseline: { readonly visibleExtent: number };
  readonly clippedAxis: "horizontal" | "vertical";
  readonly computedStyles: {
    readonly overflowX: string;
    readonly overflowY: string;
    readonly whiteSpace: string;
  };
  readonly detectorId: "text-clipping";
  readonly locator: string;
  readonly measuredDelta: number;
  readonly mutated: { readonly hiddenExtent: number };
  readonly possibleCause: string;
  readonly scenarioId: ScenarioId;
  readonly textOwner: { readonly locator: string };
};

type BoundarySnapshot = {
  readonly boundary: HTMLElement;
  readonly baselineRects: readonly RangeRect[];
  readonly range: Text;
  readonly visibleExtent: Readonly<Record<SerializedTextClippingFinding["clippedAxis"], number>>;
};

export type TextClippingBaseline = {
  readonly excludedTargets: number;
  readonly inconclusiveReasons: readonly string[];
  readonly inconclusiveTargets: number;
  readonly snapshots: readonly BoundarySnapshot[];
};

export type TextClippingDetection = {
  readonly comparableTargets: readonly Text[];
  readonly contributorTargets: readonly Text[];
  readonly excludedTargets: number;
  readonly findings: readonly SerializedTextClippingFinding[];
  readonly inconclusiveReasons: readonly string[];
  readonly inconclusiveTargets: number;
};

type Geometry = {
  readonly boundary: DOMRect;
  readonly range: DOMRect;
  readonly rangeRects: readonly RangeRect[];
};

type HiddenInterval = { readonly end: number; readonly start: number };

const epsilon = 0.5;

const locatorFor = (element: Element): string => {
  const id = element.getAttribute("id");
  return id === null || id === ""
    ? element.tagName.toLowerCase()
    : `${element.tagName.toLowerCase()}#${id}`;
};

const redactPreview = (value: string): string =>
  value
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/gu, "[redacted-email]")
    .replace(/\d/gu, "•")
    .slice(0, 48);

const toRangeRect = (rect: DOMRect): RangeRect => ({
  bottom: rect.bottom,
  height: rect.height,
  left: rect.left,
  right: rect.right,
  top: rect.top,
  width: rect.width,
});

const rangeGeometry = (document: Document, target: Text): Omit<Geometry, "boundary"> | null => {
  const range = document.createRange();
  range.selectNodeContents(target);
  const rect = range.getBoundingClientRect();
  const rangeRects = Array.from(range.getClientRects())
    .filter((candidate) => candidate.width > 0 && candidate.height > 0)
    .map(toRangeRect);
  return rect.width > 0 && rect.height > 0 && rangeRects.length > 0
    ? { range: rect, rangeRects }
    : null;
};

const hasEffectiveLineClamp = (
  boundary: HTMLElement,
  style: CSSStyleDeclaration,
  lineClamp: string,
): boolean => {
  if (
    !/^\d+$/u.test(lineClamp) ||
    style.getPropertyValue("-webkit-box-orient") !== "vertical" ||
    (style.overflowX !== "hidden" && style.overflowY !== "hidden")
  ) {
    return false;
  }
  if (style.display === "-webkit-box") return true;
  if (style.display !== "flow-root") return false;
  const lineHeight = Number.parseFloat(style.lineHeight);
  const expectedHeight = Number.parseInt(lineClamp, 10) * lineHeight;
  const contentHeight =
    boundary.clientHeight -
    Number.parseFloat(style.paddingTop) -
    Number.parseFloat(style.paddingBottom);
  return Number.isFinite(expectedHeight) && Math.abs(contentHeight - expectedHeight) <= epsilon;
};

const isClippingOverflow = (value: string): boolean =>
  value === "hidden" || value === "clip";

const isExplicitTruncation = (
  boundary: HTMLElement,
  style: CSSStyleDeclaration,
  clippedAxes: readonly SerializedTextClippingFinding["clippedAxis"][],
): boolean => {
  const lineClamp = style.getPropertyValue("-webkit-line-clamp");
  return (
    (style.textOverflow === "ellipsis" &&
      style.whiteSpace === "nowrap" &&
      clippedAxes.includes("horizontal")) ||
    (hasEffectiveLineClamp(boundary, style, lineClamp) && clippedAxes.includes("vertical"))
  );
};

const resolveBoundaries = (target: Text, document: Document): readonly HTMLElement[] => {
  const view = document.defaultView;
  let current = target.parentElement;
  const boundaries: HTMLElement[] = [];
  if (view === null) return boundaries;
  while (current !== null && current !== document.body) {
    const style = view.getComputedStyle(current);
    if (
      style.overflowX === "hidden" ||
      style.overflowX === "clip" ||
      style.overflowY === "hidden" ||
      style.overflowY === "clip"
    ) {
      boundaries.push(current);
    }
    current = current.parentElement;
  }
  return boundaries;
};

const geometryFor = (document: Document, target: Text, boundary: HTMLElement): Geometry | null => {
  const range = rangeGeometry(document, target);
  if (range === null) return null;
  return { boundary: boundary.getBoundingClientRect(), ...range };
};

const sameRect = (
  a: Pick<DOMRect, "bottom" | "left" | "right" | "top">,
  b: Pick<DOMRect, "bottom" | "left" | "right" | "top">,
): boolean =>
  Math.abs(a.left - b.left) <= epsilon &&
  Math.abs(a.right - b.right) <= epsilon &&
  Math.abs(a.top - b.top) <= epsilon &&
  Math.abs(a.bottom - b.bottom) <= epsilon;

const sameGeometry = (a: Geometry, b: Geometry): boolean =>
  sameRect(a.range, b.range) &&
  sameRect(a.boundary, b.boundary) &&
  a.rangeRects.length === b.rangeRects.length &&
  a.rangeRects.every((rect, index) => sameRect(rect, b.rangeRects[index]!));

const visibleInside = ({ boundary, range }: Geometry): boolean =>
  range.left >= boundary.left - epsilon &&
  range.right <= boundary.right + epsilon &&
  range.top >= boundary.top - epsilon &&
  range.bottom <= boundary.bottom + epsilon;

const appendReason = (reasons: string[], reason: string): void => {
  if (!reasons.includes(reason)) reasons.push(reason);
};

const uncoveredExtent = (
  interval: HiddenInterval,
  coveredIntervals: readonly HiddenInterval[],
): number => {
  const overlaps = coveredIntervals
    .map((covered) => ({
      end: Math.min(interval.end, covered.end),
      start: Math.max(interval.start, covered.start),
    }))
    .filter((overlap) => overlap.end > overlap.start)
    .sort((a, b) => a.start - b.start);
  let uncovered = 0;
  let cursor = interval.start;
  for (const overlap of overlaps) {
    if (overlap.start > cursor) uncovered += overlap.start - cursor;
    cursor = Math.max(cursor, overlap.end);
  }
  return uncovered + Math.max(0, interval.end - cursor);
};

const appendCoveredInterval = (
  foundIntervals: Map<Text, Map<SerializedTextClippingFinding["clippedAxis"], HiddenInterval[]>>,
  range: Text,
  axis: SerializedTextClippingFinding["clippedAxis"],
  interval: HiddenInterval,
): void => {
  const intervalsByAxis = foundIntervals.get(range) ?? new Map();
  const intervals = intervalsByAxis.get(axis) ?? [];
  intervals.push(interval);
  intervalsByAxis.set(axis, intervals);
  foundIntervals.set(range, intervalsByAxis);
};

export async function captureTextClippingBaseline(options: {
  readonly document: Document;
  readonly targets: readonly Text[];
}): Promise<TextClippingBaseline> {
  const view = options.document.defaultView;
  if (view === null) return { excludedTargets: 0, inconclusiveReasons: ["text-clipping-view-unavailable"], inconclusiveTargets: 1, snapshots: [] };
  if (!(await nextMeasurementFrame(view))) {
    return { excludedTargets: 0, inconclusiveReasons: ["text-clipping-sampling-timeout"], inconclusiveTargets: 1, snapshots: [] };
  }
  const excludedTargets = new Set<Text>();
  const replacedTargets = new Set<Text>();
  const candidates = options.targets.flatMap((target) => {
    if (!target.isConnected || target.ownerDocument !== options.document) {
      replacedTargets.add(target);
      return [];
    }
    const boundaryGeometries = resolveBoundaries(target, options.document).map((boundary) => ({
      boundary,
      geometry: geometryFor(options.document, target, boundary),
    }));
    if (
      boundaryGeometries.some(
        ({ boundary, geometry }) => {
          if (geometry === null) return false;
          const style = view.getComputedStyle(boundary);
          const clippedAxes = [
            ...(isClippingOverflow(style.overflowX) &&
            geometry.range.right > geometry.boundary.right + epsilon
              ? ["horizontal" as const]
              : []),
            ...(isClippingOverflow(style.overflowY) &&
            geometry.range.bottom > geometry.boundary.bottom + epsilon
              ? ["vertical" as const]
              : []),
          ];
          return isExplicitTruncation(boundary, style, clippedAxes);
        },
      )
    ) {
      excludedTargets.add(target);
      return [];
    }
    return boundaryGeometries.flatMap(({ boundary, geometry }) =>
      geometry !== null && visibleInside(geometry) ? [{ boundary, first: geometry, target }] : [],
    );
  });
  if (!(await nextMeasurementFrame(view))) {
    return { excludedTargets: excludedTargets.size, inconclusiveReasons: ["text-clipping-sampling-timeout"], inconclusiveTargets: 1, snapshots: [] };
  }
  const inconclusiveReasons: string[] =
    replacedTargets.size > 0 ? ["text-clipping-target-replaced-or-disconnected"] : [];
  const inconclusiveTargets = new Set<Text>(replacedTargets);
  const snapshots: BoundarySnapshot[] = [];
  for (const candidate of candidates) {
    const geometry = geometryFor(options.document, candidate.target, candidate.boundary);
    if (geometry === null || !sameGeometry(candidate.first, geometry)) {
      appendReason(inconclusiveReasons, "text-clipping-baseline-unstable");
      inconclusiveTargets.add(candidate.target);
      continue;
    }
    snapshots.push({
      boundary: candidate.boundary,
      baselineRects: geometry.rangeRects,
      range: candidate.target,
      visibleExtent: {
        horizontal: geometry.range.width,
        vertical: geometry.range.height,
      },
    });
  }
  return {
    excludedTargets: excludedTargets.size,
    inconclusiveReasons,
    inconclusiveTargets: inconclusiveTargets.size,
    snapshots,
  };
}

export async function detectTextClipping(options: {
  readonly baseline: TextClippingBaseline;
  readonly document: Document;
  readonly expectedAppliedValues: ReadonlyMap<Text, string>;
  readonly isTargetMutationCurrent: (target: Text) => boolean;
  readonly scenarioId: ScenarioId;
  readonly targets: readonly Text[];
}): Promise<TextClippingDetection> {
  const view = options.document.defaultView;
  if (view === null) return { comparableTargets: [], contributorTargets: [], excludedTargets: options.baseline.excludedTargets, findings: [], inconclusiveReasons: ["text-clipping-view-unavailable"], inconclusiveTargets: 1 };
  if (!(await nextMeasurementFrame(view))) {
    return { comparableTargets: [], contributorTargets: [], excludedTargets: options.baseline.excludedTargets, findings: [], inconclusiveReasons: ["text-clipping-sampling-timeout"], inconclusiveTargets: options.baseline.inconclusiveTargets + 1 };
  }
  const candidates = options.baseline.snapshots.map((snapshot) => ({
    first: geometryFor(options.document, snapshot.range, snapshot.boundary),
    snapshot,
  }));
  if (!(await nextMeasurementFrame(view))) {
    return { comparableTargets: [], contributorTargets: [], excludedTargets: options.baseline.excludedTargets, findings: [], inconclusiveReasons: ["text-clipping-sampling-timeout"], inconclusiveTargets: options.baseline.inconclusiveTargets + 1 };
  }
  const inconclusiveReasons = [...options.baseline.inconclusiveReasons];
  const findings = new Map<HTMLElement, Map<string, SerializedTextClippingFinding>>();
  const knownRanges = new Set(options.baseline.snapshots.map(({ range }) => range));
  const foundIntervals = new Map<
    Text,
    Map<SerializedTextClippingFinding["clippedAxis"], HiddenInterval[]>
  >();
  const excludedTargets = new Set<Text>();
  const inconclusiveTargets = new Set<Text>();
  const comparableTargets = new Set<Text>();
  const contributorTargets = new Set<Text>();
  for (const candidate of candidates) {
    const { snapshot } = candidate;
    if (
      candidate.first === null ||
      !snapshot.range.isConnected ||
      snapshot.range.ownerDocument !== options.document ||
      !snapshot.boundary.isConnected ||
      snapshot.boundary.ownerDocument !== options.document
    ) {
      appendReason(inconclusiveReasons, "text-clipping-target-replaced-or-disconnected");
      inconclusiveTargets.add(snapshot.range);
      continue;
    }
    const expectedValue = options.expectedAppliedValues.get(snapshot.range);
    if (expectedValue === undefined) continue;
    if (
      expectedValue !== snapshot.range.data ||
      !options.isTargetMutationCurrent(snapshot.range)
    ) {
      appendReason(inconclusiveReasons, "text-clipping-mutated-source-changed");
      inconclusiveTargets.add(snapshot.range);
      continue;
    }
    const boundaries = resolveBoundaries(snapshot.range, options.document);
    const geometry = geometryFor(options.document, snapshot.range, snapshot.boundary);
    if (
      !boundaries.includes(snapshot.boundary) ||
      geometry === null
    ) {
      appendReason(inconclusiveReasons, "text-clipping-boundary-unisolated");
      inconclusiveTargets.add(snapshot.range);
      continue;
    }
    if (!sameGeometry(candidate.first, geometry)) {
      appendReason(inconclusiveReasons, "text-clipping-mutated-geometry-unstable");
      inconclusiveTargets.add(snapshot.range);
      continue;
    }
    comparableTargets.add(snapshot.range);
    const style = view.getComputedStyle(snapshot.boundary);
    const clippedAxes = [
      ...(isClippingOverflow(style.overflowX)
        ? [{ axis: "horizontal" as const, interval: { end: geometry.range.right, start: geometry.boundary.right } }]
        : []),
      ...(isClippingOverflow(style.overflowY)
        ? [{ axis: "vertical" as const, interval: { end: geometry.range.bottom, start: geometry.boundary.bottom } }]
        : []),
    ];
    const visibleAxes = clippedAxes.filter(
      ({ axis, interval }) =>
        interval.end - interval.start > epsilon &&
        uncoveredExtent(
          interval,
          foundIntervals.get(snapshot.range)?.get(axis) ?? [],
        ) > epsilon,
    );
    if (visibleAxes.length === 0) continue;
    if (isExplicitTruncation(snapshot.boundary, style, visibleAxes.map(({ axis }) => axis))) {
      excludedTargets.add(snapshot.range);
      for (const { axis, interval } of visibleAxes) {
        appendCoveredInterval(foundIntervals, snapshot.range, axis, interval);
      }
      continue;
    }
    const locator = locatorFor(snapshot.boundary);
    const textOwner = snapshot.range.parentElement;
    if (textOwner === null) {
      appendReason(inconclusiveReasons, "text-clipping-text-owner-unavailable");
      inconclusiveTargets.add(snapshot.range);
      continue;
    }
    const affectedRange = {
      baselineRects: snapshot.baselineRects,
      locator: locatorFor(textOwner),
      mutatedRects: geometry.rangeRects,
      preview: redactPreview(snapshot.range.data),
    };
    for (const { axis: clippedAxis, interval } of visibleAxes) {
      const hiddenExtent = uncoveredExtent(
        interval,
        foundIntervals.get(snapshot.range)?.get(clippedAxis) ?? [],
      );
      const overflow = clippedAxis === "horizontal" ? style.overflowX : style.overflowY;
      const findingKey = `${clippedAxis}:${overflow}`;
      const findingsForBoundary = findings.get(snapshot.boundary) ?? new Map();
      const existing = findingsForBoundary.get(findingKey);
      if (existing !== undefined) {
        findingsForBoundary.set(findingKey, {
          ...existing,
          affectedRanges: [...existing.affectedRanges, affectedRange],
          baseline: {
            visibleExtent: Math.max(
              existing.baseline.visibleExtent,
              snapshot.visibleExtent[clippedAxis],
            ),
          },
          measuredDelta: Math.max(existing.measuredDelta, hiddenExtent),
          mutated: { hiddenExtent: Math.max(existing.mutated.hiddenExtent, hiddenExtent) },
        });
        findings.set(snapshot.boundary, findingsForBoundary);
        contributorTargets.add(snapshot.range);
        appendCoveredInterval(foundIntervals, snapshot.range, clippedAxis, interval);
        continue;
      }
      const edge = clippedAxis === "horizontal" ? "right" : "bottom";
      findingsForBoundary.set(findingKey, {
        detectorId: "text-clipping",
        clippedAxis,
        locator,
        affectedRange,
        affectedRanges: [affectedRange],
        textOwner: { locator: locatorFor(textOwner) },
        baseline: { visibleExtent: snapshot.visibleExtent[clippedAxis] },
        mutated: { hiddenExtent },
        measuredDelta: hiddenExtent,
        computedStyles: {
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          whiteSpace: style.whiteSpace,
        },
        possibleCause: `${locator} has overflow-${clippedAxis === "horizontal" ? "x" : "y"}: ${overflow} while the affected text exceeds its ${edge} boundary.`,
        scenarioId: options.scenarioId,
      });
      findings.set(snapshot.boundary, findingsForBoundary);
      contributorTargets.add(snapshot.range);
      appendCoveredInterval(foundIntervals, snapshot.range, clippedAxis, interval);
    }
  }
  for (const target of options.targets) {
    if (knownRanges.has(target) || !target.isConnected) continue;
    const owner = target.parentElement;
    const targetGeometry = rangeGeometry(options.document, target);
    if (
      owner !== null &&
      targetGeometry !== null &&
      targetGeometry.range.right > owner.getBoundingClientRect().right + epsilon &&
      owner.scrollWidth > owner.clientWidth + epsilon &&
      resolveBoundaries(target, options.document).length === 0
    ) {
      appendReason(inconclusiveReasons, "text-clipping-boundary-unisolated");
      inconclusiveTargets.add(target);
    }
  }
  return {
    comparableTargets: [...comparableTargets],
    contributorTargets: [...contributorTargets],
    excludedTargets: excludedTargets.size + options.baseline.excludedTargets,
    findings: [...findings.values()].flatMap((findingsForBoundary) => [...findingsForBoundary.values()]).sort(
      (a, b) =>
        b.measuredDelta - a.measuredDelta ||
        a.locator.localeCompare(b.locator) ||
        a.clippedAxis.localeCompare(b.clippedAxis),
    ),
    inconclusiveReasons,
    inconclusiveTargets: inconclusiveTargets.size + options.baseline.inconclusiveTargets,
  };
}
