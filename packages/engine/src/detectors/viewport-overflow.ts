// SPDX-License-Identifier: Apache-2.0

type DocumentGeometry = {
  readonly extent: number;
  readonly viewportWidth: number;
};

type ElementGeometry = {
  readonly left: number;
  readonly right: number;
};

type Snapshot = {
  readonly element: HTMLElement;
  readonly geometry: ElementGeometry;
  readonly target: Text;
};

export type SerializedViewportOverflowFinding = {
  readonly baseline: { readonly documentExtent: number; readonly excess: number; readonly viewportWidth: number };
  readonly contributionSide: "inline-end";
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
  readonly scenarioId: "unbreakable-text";
};

export type ViewportOverflowBaseline = {
  readonly geometry: DocumentGeometry | null;
  readonly inconclusiveReasons: readonly string[];
  readonly inconclusiveTargets: number;
  readonly snapshots: readonly Snapshot[];
};

export type ViewportOverflowDetection = {
  readonly findings: readonly SerializedViewportOverflowFinding[];
  readonly inconclusiveReasons: readonly string[];
  readonly inconclusiveTargets: number;
};

const epsilon = 0.5;
const documentExtentTolerance = 1;
const nextFrame = (view: Window): Promise<void> =>
  new Promise((resolve) => view.requestAnimationFrame(() => resolve()));

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
  return (
    style.position === "static" &&
    style.transform === "none" &&
    style.animationName === "none" &&
    style.contain === "none" &&
    style.contentVisibility === "visible" &&
    style.overflowX === "visible" &&
    style.willChange === "auto" &&
    Number.parseFloat(style.marginLeft) >= 0 &&
    Number.parseFloat(style.marginRight) >= 0
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

export async function captureViewportOverflowBaseline(options: {
  readonly document: Document;
  readonly targets: readonly Text[];
}): Promise<ViewportOverflowBaseline> {
  const view = options.document.defaultView;
  if (view === null || !isTopLevel(view)) {
    return { geometry: null, inconclusiveReasons: ["viewport-overflow-view-unavailable"], inconclusiveTargets: 1, snapshots: [] };
  }
  await nextFrame(view);
  const geometry = documentGeometry(options.document);
  const seen = new Set<HTMLElement>();
  const candidates = options.targets.flatMap((target) => {
    const element = target.parentElement;
    if (element === null || !target.isConnected || seen.has(element) || !pathIsEligible(element, options.document, view)) return [];
    seen.add(element);
    return [{ element, geometry: elementGeometry(element, view), target }];
  });
  await nextFrame(view);
  const stableDocument = stable(geometry, documentGeometry(options.document));
  const unstableTargets = new Set<Text>();
  for (const candidate of candidates) {
    if (
      !candidate.target.isConnected ||
      candidate.target.parentElement !== candidate.element ||
      !candidate.element.isConnected ||
      candidate.element.ownerDocument !== options.document ||
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
}): Promise<ViewportOverflowDetection> {
  const view = options.document.defaultView;
  if (view === null || !isTopLevel(view) || options.baseline.geometry === null) {
    return {
      findings: [],
      inconclusiveReasons: view === null ? ["viewport-overflow-view-unavailable"] : options.baseline.inconclusiveReasons,
      inconclusiveTargets: options.baseline.inconclusiveTargets + (view === null ? 1 : 0),
    };
  }
  await nextFrame(view);
  const geometry = documentGeometry(options.document);
  const candidates = options.baseline.snapshots.map((snapshot) => ({ snapshot, geometry: elementGeometry(snapshot.element, view) }));
  await nextFrame(view);
  const stableDocument = stable(geometry, documentGeometry(options.document));
  if (!stableDocument) {
    return {
      findings: [],
      inconclusiveReasons: [...options.baseline.inconclusiveReasons, "viewport-overflow-mutated-geometry-unstable"],
      inconclusiveTargets: options.baseline.inconclusiveTargets + 1,
    };
  }
  const baselineExcess = excess(options.baseline.geometry);
  const mutatedExcess = excess(geometry);
  if (mutatedExcess <= epsilon || mutatedExcess - baselineExcess <= epsilon) {
    return { findings: [], inconclusiveReasons: options.baseline.inconclusiveReasons, inconclusiveTargets: options.baseline.inconclusiveTargets };
  }
  const ineligibleTargets = new Set<Text>();
  const contributors = candidates.flatMap(({ snapshot, geometry: mutated }) => {
    const expected = options.expectedAppliedValues.get(snapshot.target);
    if (
      expected === undefined ||
      snapshot.target.data !== expected ||
      !snapshot.target.isConnected ||
      snapshot.target.parentElement !== snapshot.element ||
      !snapshot.element.isConnected ||
      snapshot.element.ownerDocument !== options.document ||
      !pathIsEligible(snapshot.element, options.document, view) ||
      !stable(mutated, elementGeometry(snapshot.element, view))
    ) {
      ineligibleTargets.add(snapshot.target);
      return [];
    }
    const contribution = Math.max(0, mutated.right - geometry.viewportWidth);
    const worsening = Math.max(0, mutated.right - snapshot.geometry.right);
    return contribution > epsilon &&
      worsening > epsilon &&
      mutated.right >= geometry.extent - documentExtentTolerance
      ? [{ contribution, locator: locatorFor(snapshot.element), mutated, snapshot, worsening }]
      : [];
  });
  if (ineligibleTargets.size > 0) {
    return {
      findings: [],
      inconclusiveReasons: [...options.baseline.inconclusiveReasons, "viewport-overflow-contributor-geometry-unsupported"],
      inconclusiveTargets: options.baseline.inconclusiveTargets + ineligibleTargets.size,
    };
  }
  if (contributors.length === 0) {
    return {
      findings: [],
      inconclusiveReasons: [...options.baseline.inconclusiveReasons, "viewport-overflow-direct-contributor-unisolated"],
      inconclusiveTargets: options.baseline.inconclusiveTargets + 1,
    };
  }
  const deduplicated = contributors.filter(
    (candidate) =>
      !contributors.some(
        (other) =>
          other !== candidate &&
          candidate.snapshot.element.contains(other.snapshot.element) &&
          Math.abs(candidate.mutated.right - other.mutated.right) <= epsilon,
      ),
  );
  const primary = [...deduplicated].sort((left, right) => {
    const contributionOrder = right.contribution - left.contribution;
    if (contributionOrder !== 0) return contributionOrder;
    const worseningOrder = right.worsening - left.worsening;
    if (worseningOrder !== 0) return worseningOrder;
    return left.snapshot.element.compareDocumentPosition(right.snapshot.element) &
      Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : 1;
  })[0];
  if (primary === undefined) {
    return {
      findings: [],
      inconclusiveReasons: [...options.baseline.inconclusiveReasons, "viewport-overflow-direct-contributor-unisolated"],
      inconclusiveTargets: options.baseline.inconclusiveTargets + 1,
    };
  }
  const finding: SerializedViewportOverflowFinding = {
    baseline: { documentExtent: options.baseline.geometry.extent, excess: baselineExcess, viewportWidth: options.baseline.geometry.viewportWidth },
    contributionSide: "inline-end",
    detectorId: "viewport-overflow",
    locator: "target-page",
    measuredDelta: mutatedExcess - baselineExcess,
    mutated: { documentExtent: geometry.extent, excess: mutatedExcess, viewportWidth: geometry.viewportWidth },
    possibleCause: `${primary.locator} extends the Target Page beyond its layout viewport after Unbreakable Text.`,
    primaryContributor: {
      baseline: primary.snapshot.geometry,
      contribution: primary.contribution,
      locator: primary.locator,
      mutated: primary.mutated,
    },
    scenarioId: "unbreakable-text",
  };
  return { findings: [finding], inconclusiveReasons: options.baseline.inconclusiveReasons, inconclusiveTargets: options.baseline.inconclusiveTargets };
}
