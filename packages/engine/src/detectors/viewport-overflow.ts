// SPDX-License-Identifier: Apache-2.0

import type { ScenarioId } from "../run/run-controller.js";
import { nextMeasurementFrame } from "./measurement-window.js";

type DocumentGeometry = {
  readonly extent: number;
  readonly viewportWidth: number;
};

type ElementGeometry = {
  readonly left: number;
  readonly right: number;
};

type ContributionSide = "inline-start" | "inline-end" | "both";

type ElementExcess = {
  readonly inlineEnd: number;
  readonly inlineStart: number;
  readonly maximum: number;
  readonly side: ContributionSide;
};

type Snapshot = {
  readonly element: HTMLElement;
  readonly direction: "ltr" | "rtl";
  readonly geometry: ElementGeometry;
  readonly target: Text;
};

export type SerializedViewportOverflowFinding = {
  readonly baseline: { readonly documentExtent: number; readonly excess: number; readonly viewportWidth: number };
  readonly contributionSide: ContributionSide;
  readonly contributors: readonly {
    readonly baseline: { readonly excess: number };
    readonly contribution: number;
    readonly contributionSide: ContributionSide;
    readonly locator: string;
    readonly measuredDelta: number;
    readonly mutated: { readonly excess: number };
  }[];
  readonly detectorId: "viewport-overflow";
  readonly locator: "target-page";
  readonly measuredDelta: number;
  readonly mutated: { readonly documentExtent: number; readonly excess: number; readonly viewportWidth: number };
  readonly possibleCause: string;
  readonly primaryContributor: {
    readonly baseline: ElementGeometry;
    readonly contribution: number;
    readonly locator: string;
    readonly mutated: ElementGeometry;
  };
  readonly scenarioId: ScenarioId;
};

export type ViewportOverflowBaseline = {
  readonly geometry: DocumentGeometry | null;
  readonly inconclusiveReasons: readonly string[];
  readonly inconclusiveTargets: number;
  readonly snapshots: readonly Snapshot[];
};

export type ViewportOverflowDetection = {
  readonly comparableTargets: readonly Text[];
  readonly contributorTargets: readonly Text[];
  readonly findings: readonly SerializedViewportOverflowFinding[];
  readonly liveReferences: ReadonlyMap<
    SerializedViewportOverflowFinding,
    { readonly primaryContributor: HTMLElement }
  >;
  readonly inconclusiveReasons: readonly string[];
  readonly inconclusiveTargets: number;
};

const epsilon = 0.5;
const documentExtentTolerance = 1;
const scenarioLabel = (scenarioId: ScenarioId): string =>
  scenarioId === "large-text"
    ? "Large Text"
    : scenarioId === "long-text"
      ? "Long Text"
      : "Unbreakable Text";

const locatorFor = (element: Element): string => {
  const id = element.getAttribute("id");
  return id === null || id === "" ? element.tagName.toLowerCase() : `${element.tagName.toLowerCase()}#${id}`;
};

const isTopLevel = (view: Window): boolean => {
  try {
    return view.top === view;
  } catch {
    return false;
  }
};

const isEligibleGeometry = (element: HTMLElement, view: Window): boolean => {
  const style = view.getComputedStyle(element);
  const hasGeneratedContent = ["::before", "::after"].some((pseudo) => {
    const content = view.getComputedStyle(element, pseudo).content;
    return content !== "none" && content !== "normal" && content !== "";
  });
  return (
    style.position === "static" &&
    style.transform === "none" &&
    style.animationName === "none" &&
    style.contain === "none" &&
    style.contentVisibility === "visible" &&
    style.overflowX === "visible" &&
    style.willChange === "auto" &&
    !hasGeneratedContent &&
    Number.isFinite(Number.parseFloat(style.marginLeft)) &&
    Number.isFinite(Number.parseFloat(style.marginRight))
  );
};

const pathIsEligible = (element: HTMLElement, document: Document, view: Window): boolean => {
  for (let current: HTMLElement | null = element; current !== null; current = current.parentElement) {
    if (current.matches("canvas, marquee")) return false;
    if (!isEligibleGeometry(current, view)) return false;
    if (current === document.body) return true;
  }
  return false;
};

const documentGeometry = (document: Document): DocumentGeometry => {
  const root = document.documentElement;
  const body = document.body;
  return {
    extent: Math.max(
      root.clientWidth,
      root.offsetWidth,
      root.scrollWidth,
      body?.clientWidth ?? 0,
      body?.offsetWidth ?? 0,
      body?.scrollWidth ?? 0,
    ),
    viewportWidth: root.clientWidth,
  };
};

const elementGeometry = (element: HTMLElement, view: Window): ElementGeometry => {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left + view.scrollX,
    right: rect.left + view.scrollX + Math.max(rect.width, element.scrollWidth),
  };
};

const stable = <Geometry extends object>(before: Geometry, after: Geometry): boolean =>
  (Object.keys(before) as (keyof Geometry)[]).every(
    (key) => Math.abs(Number(before[key]) - Number(after[key])) <= epsilon,
  );

const excess = (geometry: DocumentGeometry): number =>
  Math.max(0, geometry.extent - geometry.viewportWidth);

const directionFor = (element: HTMLElement, view: Window): "ltr" | "rtl" =>
  view.getComputedStyle(element).direction === "rtl" ? "rtl" : "ltr";

const elementExcess = (
  geometry: ElementGeometry,
  viewportWidth: number,
  direction: "ltr" | "rtl",
): ElementExcess => {
  const physicalStart = Math.max(0, -geometry.left);
  const physicalEnd = Math.max(0, geometry.right - viewportWidth);
  const inlineStart = direction === "ltr" ? physicalStart : physicalEnd;
  const inlineEnd = direction === "ltr" ? physicalEnd : physicalStart;
  return {
    inlineEnd,
    inlineStart,
    maximum: Math.max(inlineStart, inlineEnd),
    side: inlineStart > epsilon && inlineEnd > epsilon
      ? "both"
      : inlineStart > epsilon
        ? "inline-start"
        : "inline-end",
  };
};

const sameContributionBoundary = (
  candidate: { readonly mutated: ElementGeometry; readonly mutatedExcess: ElementExcess; readonly snapshot: Snapshot },
  other: { readonly mutated: ElementGeometry; readonly mutatedExcess: ElementExcess; readonly snapshot: Snapshot },
): boolean => {
  const compareInlineStart = candidate.mutatedExcess.side === "inline-start" || candidate.mutatedExcess.side === "both";
  const compareInlineEnd = candidate.mutatedExcess.side === "inline-end" || candidate.mutatedExcess.side === "both";
  const inlineStartMatches = candidate.snapshot.direction === "ltr"
    ? Math.abs(candidate.mutated.left - other.mutated.left) <= epsilon
    : Math.abs(candidate.mutated.right - other.mutated.right) <= epsilon;
  const inlineEndMatches = candidate.snapshot.direction === "ltr"
    ? Math.abs(candidate.mutated.right - other.mutated.right) <= epsilon
    : Math.abs(candidate.mutated.left - other.mutated.left) <= epsilon;
  return (!compareInlineStart || inlineStartMatches) && (!compareInlineEnd || inlineEndMatches);
};

const explainsDocumentExtent = (
  candidate: { readonly mutated: ElementGeometry },
  geometry: DocumentGeometry,
): boolean => {
  const pageExcess = excess(geometry);
  return candidate.mutated.right >= geometry.extent - documentExtentTolerance ||
    -candidate.mutated.left >= pageExcess - documentExtentTolerance;
};

export async function captureViewportOverflowBaseline(options: {
  readonly document: Document;
  readonly targets: readonly Text[];
}): Promise<ViewportOverflowBaseline> {
  const view = options.document.defaultView;
  if (view === null || !isTopLevel(view)) {
    return { geometry: null, inconclusiveReasons: ["viewport-overflow-view-unavailable"], inconclusiveTargets: 1, snapshots: [] };
  }
  if (!(await nextMeasurementFrame(view))) {
    return { geometry: null, inconclusiveReasons: ["viewport-overflow-sampling-timeout"], inconclusiveTargets: 1, snapshots: [] };
  }
  const geometry = documentGeometry(options.document);
  const seen = new Set<HTMLElement>();
  const candidates = options.targets.flatMap((target) => {
    const element = target.parentElement;
    if (element === null || !target.isConnected || seen.has(element) || !pathIsEligible(element, options.document, view)) return [];
    seen.add(element);
    return [{ direction: directionFor(element, view), element, geometry: elementGeometry(element, view), target }];
  });
  if (!(await nextMeasurementFrame(view))) {
    return { geometry: null, inconclusiveReasons: ["viewport-overflow-sampling-timeout"], inconclusiveTargets: 1, snapshots: [] };
  }
  const stableDocument = stable(geometry, documentGeometry(options.document));
  const unstableTargets = new Set<Text>();
  for (const candidate of candidates) {
    if (
      !candidate.target.isConnected ||
      candidate.target.parentElement !== candidate.element ||
      !candidate.element.isConnected ||
      candidate.element.ownerDocument !== options.document ||
      candidate.direction !== directionFor(candidate.element, view) ||
      !pathIsEligible(candidate.element, options.document, view) ||
      !stable(candidate.geometry, elementGeometry(candidate.element, view))
    ) {
      unstableTargets.add(candidate.target);
    }
  }
  return {
    geometry: stableDocument ? geometry : null,
    inconclusiveReasons:
      !stableDocument || unstableTargets.size > 0
        ? ["viewport-overflow-baseline-geometry-unstable"]
        : [],
    inconclusiveTargets: unstableTargets.size + (stableDocument ? 0 : 1),
    snapshots: stableDocument ? candidates.filter((candidate) => !unstableTargets.has(candidate.target)) : [],
  };
}

export async function detectViewportOverflow(options: {
  readonly baseline: ViewportOverflowBaseline;
  readonly document: Document;
  readonly expectedAppliedValues: ReadonlyMap<Text, string>;
  readonly isTargetMutationCurrent: (target: Text) => boolean;
  readonly scenarioId: ScenarioId;
}): Promise<ViewportOverflowDetection> {
  const view = options.document.defaultView;
  if (view === null || !isTopLevel(view) || options.baseline.geometry === null) {
    return {
      comparableTargets: [],
      contributorTargets: [],
      findings: [],
      liveReferences: new Map(),
      inconclusiveReasons: view === null ? ["viewport-overflow-view-unavailable"] : options.baseline.inconclusiveReasons,
      inconclusiveTargets: options.baseline.inconclusiveTargets + (view === null ? 1 : 0),
    };
  }
  const baselineGeometry = options.baseline.geometry;
  if (!(await nextMeasurementFrame(view))) {
    return { comparableTargets: [], contributorTargets: [], findings: [], liveReferences: new Map(), inconclusiveReasons: ["viewport-overflow-sampling-timeout"], inconclusiveTargets: options.baseline.inconclusiveTargets + 1 };
  }
  const geometry = documentGeometry(options.document);
  const candidates = options.baseline.snapshots.map((snapshot) => ({ snapshot, geometry: elementGeometry(snapshot.element, view) }));
  if (!(await nextMeasurementFrame(view))) {
    return { comparableTargets: [], contributorTargets: [], findings: [], liveReferences: new Map(), inconclusiveReasons: ["viewport-overflow-sampling-timeout"], inconclusiveTargets: options.baseline.inconclusiveTargets + 1 };
  }
  const stableDocument = stable(geometry, documentGeometry(options.document));
  if (!stableDocument) {
    return {
      comparableTargets: [],
      contributorTargets: [],
      findings: [],
      liveReferences: new Map(),
      inconclusiveReasons: [...options.baseline.inconclusiveReasons, "viewport-overflow-mutated-geometry-unstable"],
      inconclusiveTargets: options.baseline.inconclusiveTargets + 1,
    };
  }
  const baselineExcess = excess(baselineGeometry);
  const mutatedExcess = excess(geometry);
  const ineligibleTargets = new Set<Text>();
  const comparableTargets = new Set<Text>();
  const contributors = candidates.flatMap(({ snapshot, geometry: mutated }) => {
    const expected = options.expectedAppliedValues.get(snapshot.target);
    if (
      expected === undefined ||
      snapshot.target.data !== expected ||
      !options.isTargetMutationCurrent(snapshot.target) ||
      !snapshot.target.isConnected ||
      snapshot.target.parentElement !== snapshot.element ||
      !snapshot.element.isConnected ||
      snapshot.element.ownerDocument !== options.document ||
      snapshot.direction !== directionFor(snapshot.element, view) ||
      !pathIsEligible(snapshot.element, options.document, view) ||
      !stable(mutated, elementGeometry(snapshot.element, view))
    ) {
      ineligibleTargets.add(snapshot.target);
      return [];
    }
    const baseline = elementExcess(snapshot.geometry, baselineGeometry.viewportWidth, snapshot.direction);
    const mutatedExcess = elementExcess(mutated, geometry.viewportWidth, snapshot.direction);
    comparableTargets.add(snapshot.target);
    const worsening = Math.max(0, mutatedExcess.maximum - baseline.maximum);
    return mutatedExcess.maximum > epsilon && worsening > epsilon
      ? [{ baseline, contribution: mutatedExcess.maximum, locator: locatorFor(snapshot.element), mutated, mutatedExcess, snapshot, worsening }]
      : [];
  });
  const inconclusiveReasons = ineligibleTargets.size > 0
    ? [...options.baseline.inconclusiveReasons, "viewport-overflow-contributor-geometry-unsupported"]
    : options.baseline.inconclusiveReasons;
  const inconclusiveTargets = options.baseline.inconclusiveTargets + ineligibleTargets.size;
  if (mutatedExcess <= epsilon || mutatedExcess - baselineExcess <= epsilon) {
    return {
      comparableTargets: [...comparableTargets],
      contributorTargets: [],
      findings: [],
      liveReferences: new Map(),
      inconclusiveReasons,
      inconclusiveTargets,
    };
  }
  if (contributors.length === 0) {
    return {
      comparableTargets: [...comparableTargets],
      contributorTargets: [],
      findings: [],
      liveReferences: new Map(),
      inconclusiveReasons: [...inconclusiveReasons, "viewport-contributor-not-isolated"],
      inconclusiveTargets: inconclusiveTargets + 1,
    };
  }
  const deduplicated = contributors.filter(
    (candidate) =>
      !contributors.some(
        (other) =>
          other !== candidate &&
          candidate.snapshot.element.contains(other.snapshot.element) &&
          candidate.snapshot.direction === other.snapshot.direction &&
          candidate.mutatedExcess.side === other.mutatedExcess.side &&
          sameContributionBoundary(candidate, other),
      ),
  );
  const ordered = [...deduplicated].sort((left, right) => {
    const contributionOrder = right.contribution - left.contribution;
    if (contributionOrder !== 0) return contributionOrder;
    const worseningOrder = right.worsening - left.worsening;
    if (worseningOrder !== 0) return worseningOrder;
    return left.snapshot.element.compareDocumentPosition(right.snapshot.element) &
      Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : 1;
  });
  const primary = ordered[0];
  if (primary === undefined || !ordered.some((candidate) => explainsDocumentExtent(candidate, geometry))) {
    return {
      comparableTargets: [...comparableTargets],
      contributorTargets: [],
      findings: [],
      liveReferences: new Map(),
      inconclusiveReasons: [...inconclusiveReasons, "viewport-contributor-not-isolated"],
      inconclusiveTargets: inconclusiveTargets + 1,
    };
  }
  const finding: SerializedViewportOverflowFinding = {
    baseline: { documentExtent: baselineGeometry.extent, excess: baselineExcess, viewportWidth: baselineGeometry.viewportWidth },
    contributionSide: ordered.some((candidate) => candidate.mutatedExcess.side === "inline-start") &&
      ordered.some((candidate) => candidate.mutatedExcess.side === "inline-end")
      ? "both"
      : primary.mutatedExcess.side,
    contributors: ordered.map((candidate) => ({
      baseline: { excess: candidate.baseline.maximum },
      contribution: candidate.contribution,
      contributionSide: candidate.mutatedExcess.side,
      locator: candidate.locator,
      measuredDelta: candidate.worsening,
      mutated: { excess: candidate.mutatedExcess.maximum },
    })),
    detectorId: "viewport-overflow",
    locator: "target-page",
    measuredDelta: mutatedExcess - baselineExcess,
    mutated: { documentExtent: geometry.extent, excess: mutatedExcess, viewportWidth: geometry.viewportWidth },
    possibleCause: `${primary.locator} extends the Target Page beyond its layout viewport after ${scenarioLabel(options.scenarioId)}.`,
    primaryContributor: {
      baseline: primary.snapshot.geometry,
      contribution: primary.contribution,
      locator: primary.locator,
      mutated: primary.mutated,
    },
    scenarioId: options.scenarioId,
  };
  return {
    comparableTargets: [...comparableTargets],
    contributorTargets: [...new Set(ordered.map((candidate) => candidate.snapshot.target))],
    findings: [finding],
    liveReferences: new Map([[finding, { primaryContributor: primary.snapshot.element }]]),
    inconclusiveReasons,
    inconclusiveTargets,
  };
}
