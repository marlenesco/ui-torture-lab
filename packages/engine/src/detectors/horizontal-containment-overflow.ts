// SPDX-License-Identifier: Apache-2.0

import type { ScenarioId } from "../run/run-controller.js";
import { nextMeasurementFrame } from "./measurement-window.js";

type OverflowSide = "inline-start" | "inline-end" | "both";

type ElementEvidence = {
  readonly baseline: { readonly excess: number };
  readonly locator: string;
  readonly measuredDelta: number;
  readonly mutated: { readonly excess: number };
  readonly overflowSide: OverflowSide;
};

export type SerializedHorizontalContainmentOverflowFinding = {
  readonly affectedElementCount: number;
  readonly baseline: { readonly maximumExcess: number };
  readonly detectorId: "horizontal-containment-overflow";
  readonly locator: string;
  readonly measuredDelta: number;
  readonly mutated: { readonly maximumExcess: number };
  readonly overflowSide: OverflowSide;
  readonly overflowingElements: readonly ElementEvidence[];
  readonly possibleCause: string;
  readonly scenarioId: ScenarioId;
};

type Geometry = {
  readonly boundaryLeft: number;
  readonly boundaryRight: number;
  readonly elementLeft: number;
  readonly elementRight: number;
};

type Excess = {
  readonly inlineEnd: number;
  readonly inlineStart: number;
  readonly maximum: number;
  readonly side: OverflowSide;
};

type Snapshot = {
  readonly baseline: Excess;
  readonly boundary: HTMLElement;
  readonly boundaryClipsOverflow: boolean;
  readonly direction: "ltr" | "rtl";
  readonly element: HTMLElement;
  readonly geometry: Geometry;
  readonly target: Text;
};

export type HorizontalContainmentOverflowBaseline = {
  readonly inconclusiveReasons: readonly string[];
  readonly inconclusiveTargets: number;
  readonly snapshots: readonly Snapshot[];
};

export type HorizontalContainmentOverflowDetection = {
  readonly comparableTargets: readonly Text[];
  readonly contributorTargets: readonly Text[];
  readonly findings: readonly SerializedHorizontalContainmentOverflowFinding[];
  readonly inconclusiveReasons: readonly string[];
  readonly inconclusiveTargets: number;
};

const epsilon = 0.5;
const scenarioLabel = (scenarioId: ScenarioId): string =>
  scenarioId === "large-text"
    ? "Large Text"
    : scenarioId === "long-text"
      ? "Long Text"
      : "Unbreakable Text";

const locatorFor = (element: Element): string => {
  const id = element.getAttribute("id");
  return id === null || id === ""
    ? element.tagName.toLowerCase()
    : `${element.tagName.toLowerCase()}#${id}`;
};

const appendReason = (reasons: string[], reason: string): void => {
  if (!reasons.includes(reason)) reasons.push(reason);
};

const isClippingOverflow = (value: string): boolean =>
  value === "hidden" || value === "clip";

const isOperationalHorizontalScroll = (
  element: HTMLElement,
  style: CSSStyleDeclaration,
): boolean =>
  style.overflowX === "scroll" ||
  (style.overflowX === "auto" && element.scrollWidth - element.clientWidth > epsilon);

const isAmbiguousLayout = (style: CSSStyleDeclaration): boolean =>
  (style.position !== "static" && style.position !== "relative") ||
  style.transform !== "none" ||
  style.animationName !== "none" ||
  style.willChange.includes("transform") ||
  style.cursor === "grab" ||
  style.cursor === "grabbing" ||
  style.contain !== "none" ||
  style.contentVisibility !== "visible" ||
  Number.parseFloat(style.marginLeft) < 0 ||
  Number.parseFloat(style.marginRight) < 0;

const isAmbiguousElement = (
  element: HTMLElement,
  style: CSSStyleDeclaration,
): boolean =>
  isAmbiguousLayout(style) || element.closest("canvas, marquee") !== null;

const isRelevantLayoutBoundary = (
  element: HTMLElement,
  style: CSSStyleDeclaration,
): boolean =>
  element.clientWidth > epsilon &&
  style.display !== "contents" &&
  style.display !== "inline" &&
  (isClippingOverflow(style.overflowX) ||
    Number.parseFloat(style.paddingLeft) > epsilon ||
    Number.parseFloat(style.paddingRight) > epsilon ||
    style.display === "flex" ||
    style.display === "grid" ||
    (element.parentElement !== null &&
      Math.abs(element.clientWidth - element.parentElement.clientWidth) > epsilon));

const isUnisolatableEqualWidthBoundary = (
  element: HTMLElement,
  style: CSSStyleDeclaration,
): boolean =>
  element.clientWidth > epsilon &&
  style.display !== "contents" &&
  style.display !== "inline" &&
  !isClippingOverflow(style.overflowX) &&
  Number.parseFloat(style.paddingLeft) <= epsilon &&
  Number.parseFloat(style.paddingRight) <= epsilon &&
  element.parentElement !== null &&
  Math.abs(element.clientWidth - element.parentElement.clientWidth) <= epsilon;

const pathIsEligible = (
  element: HTMLElement,
  boundary: HTMLElement,
  boundaryClipsOverflow: boolean,
  document: Document,
): boolean => {
  const view = document.defaultView;
  if (
    view === null ||
    element.ownerDocument !== document ||
    boundary.ownerDocument !== document ||
    !boundary.contains(element)
  ) {
    return false;
  }
  let current: HTMLElement | null = element;
  while (current !== null) {
    const style = view.getComputedStyle(current);
    if (
      isAmbiguousElement(current, style) ||
      (isClippingOverflow(style.overflowX) &&
        (current !== boundary || !boundaryClipsOverflow)) ||
      isOperationalHorizontalScroll(current, style)
    ) {
      return false;
    }
    if (current === boundary) return true;
    current = current.parentElement;
  }
  return false;
};

const resolveBoundaries = (
  element: HTMLElement,
  document: Document,
): readonly HTMLElement[] | null => {
  const view = document.defaultView;
  if (view === null) return null;
  const boundaries: HTMLElement[] = [];
  if (!isEligibleElement(element, view)) return null;
  let current = element.parentElement;
  while (current !== null && current !== document.body) {
    const style = view.getComputedStyle(current);
    if (
      isAmbiguousElement(current, style) || isOperationalHorizontalScroll(current, style)
    ) {
      return null;
    }
    if (isUnisolatableEqualWidthBoundary(current, style)) return null;
    if (isRelevantLayoutBoundary(current, style)) boundaries.push(current);
    if (isClippingOverflow(style.overflowX)) {
      return boundaries.length > 0 ? boundaries : null;
    }
    current = current.parentElement;
  }
  return boundaries;
};

const isEligibleElement = (element: HTMLElement, view: Window): boolean => {
  const style = view.getComputedStyle(element);
  return (
    !isAmbiguousElement(element, style) &&
    !isClippingOverflow(style.overflowX) &&
    !isOperationalHorizontalScroll(element, style)
  );
};

const geometryFor = (
  element: HTMLElement,
  boundary: HTMLElement,
  direction: "ltr" | "rtl",
): Geometry => {
  const elementRect = element.getBoundingClientRect();
  const boundaryRect = boundary.getBoundingClientRect();
  const elementWidth = Math.max(elementRect.width, element.scrollWidth);
  return {
    boundaryLeft: boundaryRect.left + boundary.clientLeft,
    boundaryRight: boundaryRect.left + boundary.clientLeft + boundary.clientWidth,
    elementLeft: direction === "ltr" ? elementRect.left : elementRect.right - elementWidth,
    elementRight: direction === "ltr" ? elementRect.left + elementWidth : elementRect.right,
  };
};

const excessFor = (geometry: Geometry, direction: "ltr" | "rtl"): Excess => {
  const physicalLeft = Math.max(0, geometry.boundaryLeft - geometry.elementLeft);
  const physicalRight = Math.max(0, geometry.elementRight - geometry.boundaryRight);
  const inlineStart = direction === "ltr" ? physicalLeft : physicalRight;
  const inlineEnd = direction === "ltr" ? physicalRight : physicalLeft;
  return {
    inlineEnd,
    inlineStart,
    maximum: Math.max(inlineStart, inlineEnd),
    side:
      inlineStart > epsilon && inlineEnd > epsilon
        ? "both"
        : inlineStart > epsilon
          ? "inline-start"
          : "inline-end",
  };
};

const geometryStable = (before: Geometry, after: Geometry): boolean =>
  (Object.keys(before) as (keyof Geometry)[]).every(
    (key) => Math.abs(before[key] - after[key]) <= epsilon,
  );

const clippingStateForText = (
  target: Text,
  boundary: HTMLElement,
  document: Document,
): "clipped" | "unavailable" | "visible" => {
  try {
    const range = document.createRange();
    range.selectNodeContents(target);
    const rect = range.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return "unavailable";
    const boundaryRect = boundary.getBoundingClientRect();
    return (
      rect.left < boundaryRect.left - epsilon ||
      rect.right > boundaryRect.right + epsilon
    )
      ? "clipped"
      : "visible";
  } catch {
    return "unavailable";
  }
};

const combinedSide = (current: OverflowSide, next: OverflowSide): OverflowSide =>
  current === next ? current : "both";

export async function captureHorizontalContainmentOverflowBaseline(options: {
  readonly document: Document;
  readonly targets: readonly Text[];
}): Promise<HorizontalContainmentOverflowBaseline> {
  const view = options.document.defaultView;
  if (view === null) {
    return {
      inconclusiveReasons: ["horizontal-containment-view-unavailable"],
      inconclusiveTargets: 1,
      snapshots: [],
    };
  }
  if (!(await nextMeasurementFrame(view))) {
    return { inconclusiveReasons: ["horizontal-containment-sampling-timeout"], inconclusiveTargets: 1, snapshots: [] };
  }
  const seenElements = new Set<HTMLElement>();
  const inconclusiveTargets = new Set<Text>();
  const candidates: Snapshot[] = [];
  for (const target of options.targets) {
    const element = target.parentElement;
    if (
      element === null ||
      !target.isConnected ||
      seenElements.has(element) ||
      !isEligibleElement(element, view)
    ) {
      continue;
    }
    seenElements.add(element);
    const boundaries = resolveBoundaries(element, options.document);
    if (boundaries === null) {
      inconclusiveTargets.add(target);
      continue;
    }
    if (boundaries.length === 0) continue;
    for (const boundary of boundaries) {
      const direction = view.getComputedStyle(boundary).direction === "rtl" ? "rtl" : "ltr";
      const boundaryClipsOverflow = isClippingOverflow(
        view.getComputedStyle(boundary).overflowX,
      );
      const geometry = geometryFor(
        element,
        boundary,
        direction,
      );
      candidates.push({
        baseline: excessFor(geometry, direction),
        boundary,
        boundaryClipsOverflow,
        direction,
        element,
        geometry,
        target,
      });
    }
  }
  if (!(await nextMeasurementFrame(view))) {
    return { inconclusiveReasons: ["horizontal-containment-sampling-timeout"], inconclusiveTargets: 1, snapshots: [] };
  }
  const unstableTargets = new Set<Text>();
  for (const candidate of candidates) {
    const direction = view.getComputedStyle(candidate.boundary).direction === "rtl" ? "rtl" : "ltr";
    if (
        !candidate.target.isConnected ||
        candidate.target.parentElement !== candidate.element ||
        !candidate.element.isConnected ||
        !candidate.boundary.isConnected ||
        !pathIsEligible(
          candidate.element,
          candidate.boundary,
          candidate.boundaryClipsOverflow,
          options.document,
        ) ||
      candidate.direction !== direction ||
      !geometryStable(
        candidate.geometry,
        geometryFor(
          candidate.element,
          candidate.boundary,
          direction,
        ),
      )
    ) {
      unstableTargets.add(candidate.target);
    }
  }
  const snapshots = candidates.filter((candidate) => !unstableTargets.has(candidate.target));
  for (const target of unstableTargets) inconclusiveTargets.add(target);
  return {
    inconclusiveReasons:
      inconclusiveTargets.size > 0
        ? ["horizontal-containment-boundary-unisolated-or-unstable"]
        : [],
    inconclusiveTargets: inconclusiveTargets.size,
    snapshots,
  };
}

export async function detectHorizontalContainmentOverflow(options: {
  readonly baseline: HorizontalContainmentOverflowBaseline;
  readonly document: Document;
  readonly expectedAppliedValues: ReadonlyMap<Text, string>;
  readonly isTargetMutationCurrent: (target: Text) => boolean;
  readonly scenarioId: ScenarioId;
}): Promise<HorizontalContainmentOverflowDetection> {
  const view = options.document.defaultView;
  if (view === null) {
    return {
      comparableTargets: [],
      contributorTargets: [],
      findings: [],
      inconclusiveReasons: ["horizontal-containment-view-unavailable"],
      inconclusiveTargets: 1,
    };
  }
  if (!(await nextMeasurementFrame(view))) {
    return { comparableTargets: [], contributorTargets: [], findings: [], inconclusiveReasons: ["horizontal-containment-sampling-timeout"], inconclusiveTargets: options.baseline.inconclusiveTargets + 1 };
  }
  const first = options.baseline.snapshots.map((snapshot) => ({
    snapshot,
    geometry: geometryFor(
      snapshot.element,
      snapshot.boundary,
      snapshot.direction,
    ),
  }));
  if (!(await nextMeasurementFrame(view))) {
    return { comparableTargets: [], contributorTargets: [], findings: [], inconclusiveReasons: ["horizontal-containment-sampling-timeout"], inconclusiveTargets: options.baseline.inconclusiveTargets + 1 };
  }
  const findings = new Map<HTMLElement, SerializedHorizontalContainmentOverflowFinding>();
  const inconclusiveTargets = new Set<Text>();
  const comparableTargets = new Set<Text>();
  const contributorTargets = new Set<Text>();
  const inconclusiveReasons = [...options.baseline.inconclusiveReasons];
  const snapshotsByTarget = new Map<Text, (typeof first)[number][]>();
  for (const candidate of first) {
    const group = snapshotsByTarget.get(candidate.snapshot.target) ?? [];
    group.push(candidate);
    snapshotsByTarget.set(candidate.snapshot.target, group);
  }
  for (const [target, candidates] of snapshotsByTarget) {
    const expectedValue = options.expectedAppliedValues.get(target);
    if (expectedValue === undefined) continue;
    if (target.data !== expectedValue || !options.isTargetMutationCurrent(target)) {
      inconclusiveTargets.add(target);
      appendReason(inconclusiveReasons, "horizontal-containment-target-replaced-or-changed");
      continue;
    }
    const foundGrowth = { inlineEnd: 0, inlineStart: 0 };
    for (const { snapshot, geometry } of candidates) {
      const style = view.getComputedStyle(snapshot.boundary);
      const direction = style.direction === "rtl" ? "rtl" : "ltr";
      if (
        !target.isConnected ||
        target.parentElement !== snapshot.element ||
        !snapshot.element.isConnected ||
        !snapshot.boundary.isConnected ||
        !pathIsEligible(
          snapshot.element,
          snapshot.boundary,
          snapshot.boundaryClipsOverflow,
          options.document,
        ) ||
        snapshot.direction !== direction ||
        snapshot.boundaryClipsOverflow !== isClippingOverflow(style.overflowX) ||
        !geometryStable(
          geometry,
          geometryFor(
            snapshot.element,
            snapshot.boundary,
            direction,
          ),
        )
      ) {
        inconclusiveTargets.add(target);
        appendReason(inconclusiveReasons, "horizontal-containment-mutated-geometry-ambiguous");
        break;
      }
      const mutated = excessFor(geometry, direction);
      comparableTargets.add(target);
      if (snapshot.boundaryClipsOverflow) {
        const clippingState = clippingStateForText(
          target,
          snapshot.boundary,
          options.document,
        );
        if (clippingState !== "visible") {
          inconclusiveTargets.add(target);
          appendReason(
            inconclusiveReasons,
            "horizontal-containment-text-clipping-ambiguous",
          );
          break;
        }
      }
      const measuredDelta = mutated.maximum - snapshot.baseline.maximum;
      const inlineStartGrowth = Math.max(0, mutated.inlineStart - snapshot.baseline.inlineStart);
      const inlineEndGrowth = Math.max(0, mutated.inlineEnd - snapshot.baseline.inlineEnd);
      if (
        measuredDelta <= epsilon ||
        mutated.maximum <= epsilon ||
        Math.max(
          inlineStartGrowth - foundGrowth.inlineStart,
          inlineEndGrowth - foundGrowth.inlineEnd,
        ) <= epsilon
      ) {
        continue;
      }
      const existing = findings.get(snapshot.boundary);
      const evidence: ElementEvidence = {
        baseline: { excess: snapshot.baseline.maximum },
        locator: locatorFor(snapshot.element),
        measuredDelta,
        mutated: { excess: mutated.maximum },
        overflowSide: mutated.side,
      };
      if (existing !== undefined) {
        findings.set(snapshot.boundary, {
          ...existing,
          affectedElementCount: existing.affectedElementCount + 1,
          baseline: { maximumExcess: Math.max(existing.baseline.maximumExcess, snapshot.baseline.maximum) },
          measuredDelta: Math.max(existing.measuredDelta, measuredDelta),
          mutated: { maximumExcess: Math.max(existing.mutated.maximumExcess, mutated.maximum) },
          overflowSide: combinedSide(existing.overflowSide, mutated.side),
          overflowingElements: [...existing.overflowingElements, evidence],
        });
      } else {
        const locator = locatorFor(snapshot.boundary);
        findings.set(snapshot.boundary, {
          affectedElementCount: 1,
          baseline: { maximumExcess: snapshot.baseline.maximum },
          detectorId: "horizontal-containment-overflow",
          locator,
          measuredDelta,
          mutated: { maximumExcess: mutated.maximum },
          overflowSide: mutated.side,
          overflowingElements: [evidence],
          possibleCause: `${evidence.locator} newly exceeds ${locator}'s usable ${mutated.side} boundary after ${scenarioLabel(options.scenarioId)}.`,
          scenarioId: options.scenarioId,
        });
      }
      contributorTargets.add(target);
      foundGrowth.inlineStart = Math.max(foundGrowth.inlineStart, inlineStartGrowth);
      foundGrowth.inlineEnd = Math.max(foundGrowth.inlineEnd, inlineEndGrowth);
    }
  }
  return {
    comparableTargets: [...comparableTargets],
    contributorTargets: [...contributorTargets],
    findings: [...findings.values()].sort(
      (left, right) =>
        right.measuredDelta - left.measuredDelta || left.locator.localeCompare(right.locator),
    ),
    inconclusiveReasons,
    inconclusiveTargets: inconclusiveTargets.size + options.baseline.inconclusiveTargets,
  };
}
