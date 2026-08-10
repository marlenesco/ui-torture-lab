// SPDX-License-Identifier: Apache-2.0

type SupportingRange = {
  readonly locator: string;
  readonly preview: string;
};

export type SerializedTextClippingFinding = {
  readonly affectedRange: SupportingRange;
  readonly affectedRanges: readonly SupportingRange[];
  readonly baseline: { readonly visibleExtent: number };
  readonly clippedAxis: "horizontal";
  readonly computedStyles: { readonly overflowX: string; readonly whiteSpace: string };
  readonly detectorId: "text-clipping";
  readonly locator: string;
  readonly measuredDelta: number;
  readonly mutated: { readonly hiddenExtent: number };
  readonly possibleCause: string;
  readonly textOwner: { readonly locator: string };
};

type BoundarySnapshot = {
  readonly boundary: HTMLElement;
  readonly range: Text;
  readonly visibleExtent: number;
};

export type TextClippingBaseline = {
  readonly excludedTargets: number;
  readonly inconclusiveReasons: readonly string[];
  readonly inconclusiveTargets: number;
  readonly snapshots: readonly BoundarySnapshot[];
};

export type TextClippingDetection = {
  readonly excludedTargets: number;
  readonly findings: readonly SerializedTextClippingFinding[];
  readonly inconclusiveReasons: readonly string[];
  readonly inconclusiveTargets: number;
};

type BoundaryResolution = {
  readonly boundaries: readonly HTMLElement[];
  readonly status: "explicit-truncation" | "resolved";
};

type Geometry = { readonly boundary: DOMRect; readonly range: DOMRect };

const epsilon = 0.5;
const nextFrame = (view: Window): Promise<void> =>
  new Promise((resolve) => view.requestAnimationFrame(() => resolve()));

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

const rangeRect = (document: Document, target: Text): DOMRect | null => {
  const range = document.createRange();
  range.selectNodeContents(target);
  const rect = range.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
};

const isExplicitTruncation = (style: CSSStyleDeclaration): boolean => {
  const lineClamp = style.getPropertyValue("-webkit-line-clamp");
  return (
    (style.textOverflow === "ellipsis" && style.whiteSpace === "nowrap") ||
    (/^\d+$/u.test(lineClamp) &&
      style.display === "-webkit-box" &&
      style.getPropertyValue("-webkit-box-orient") === "vertical" &&
      (style.overflowX === "hidden" || style.overflowY === "hidden"))
  );
};

const resolveBoundaries = (target: Text, document: Document): BoundaryResolution => {
  const view = document.defaultView;
  let current = target.parentElement;
  const boundaries: HTMLElement[] = [];
  if (view === null) return { boundaries, status: "resolved" };
  while (current !== null && current !== document.body) {
    const style = view.getComputedStyle(current);
    if (style.overflowX === "hidden" || style.overflowX === "clip") {
      if (isExplicitTruncation(style)) return { boundaries: [], status: "explicit-truncation" };
      boundaries.push(current);
    }
    current = current.parentElement;
  }
  return { boundaries, status: "resolved" };
};

const geometryFor = (document: Document, target: Text, boundary: HTMLElement): Geometry | null => {
  const range = rangeRect(document, target);
  if (range === null) return null;
  return { boundary: boundary.getBoundingClientRect(), range };
};

const sameRect = (a: DOMRect, b: DOMRect): boolean =>
  Math.abs(a.left - b.left) <= epsilon &&
  Math.abs(a.right - b.right) <= epsilon &&
  Math.abs(a.top - b.top) <= epsilon &&
  Math.abs(a.bottom - b.bottom) <= epsilon;

const sameGeometry = (a: Geometry, b: Geometry): boolean =>
  sameRect(a.range, b.range) && sameRect(a.boundary, b.boundary);

const visibleInside = ({ boundary, range }: Geometry): boolean =>
  range.left >= boundary.left - epsilon && range.right <= boundary.right + epsilon;

const appendReason = (reasons: string[], reason: string): void => {
  if (!reasons.includes(reason)) reasons.push(reason);
};

export async function captureTextClippingBaseline(options: {
  readonly document: Document;
  readonly targets: readonly Text[];
}): Promise<TextClippingBaseline> {
  const view = options.document.defaultView;
  if (view === null) return { excludedTargets: 0, inconclusiveReasons: ["text-clipping-view-unavailable"], inconclusiveTargets: 1, snapshots: [] };
  await nextFrame(view);
  let excludedTargets = 0;
  const replacedTargets = new Set<Text>();
  const candidates = options.targets.flatMap((target) => {
    if (!target.isConnected || target.ownerDocument !== options.document) {
      replacedTargets.add(target);
      return [];
    }
    const resolution = resolveBoundaries(target, options.document);
    if (resolution.status === "explicit-truncation") {
      excludedTargets += 1;
      return [];
    }
    return resolution.boundaries.flatMap((boundary) => {
      const geometry = geometryFor(options.document, target, boundary);
      return geometry !== null && visibleInside(geometry) ? [{ boundary, first: geometry, target }] : [];
    });
  });
  await nextFrame(view);
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
      range: candidate.target,
      visibleExtent: geometry.range.width,
    });
  }
  return { excludedTargets, inconclusiveReasons, inconclusiveTargets: inconclusiveTargets.size, snapshots };
}

export async function detectTextClipping(options: {
  readonly baseline: TextClippingBaseline;
  readonly document: Document;
  readonly expectedAppliedValues: ReadonlyMap<Text, string>;
  readonly targets: readonly Text[];
}): Promise<TextClippingDetection> {
  const view = options.document.defaultView;
  if (view === null) return { excludedTargets: options.baseline.excludedTargets, findings: [], inconclusiveReasons: ["text-clipping-view-unavailable"], inconclusiveTargets: 1 };
  await nextFrame(view);
  const candidates = options.baseline.snapshots.map((snapshot) => ({
    first: geometryFor(options.document, snapshot.range, snapshot.boundary),
    snapshot,
  }));
  await nextFrame(view);
  const inconclusiveReasons = [...options.baseline.inconclusiveReasons];
  const findings = new Map<HTMLElement, SerializedTextClippingFinding>();
  const knownRanges = new Set(options.baseline.snapshots.map(({ range }) => range));
  const foundRanges = new Set<Text>();
  const inconclusiveTargets = new Set<Text>();
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
    if (options.expectedAppliedValues.get(snapshot.range) !== snapshot.range.data) {
      appendReason(inconclusiveReasons, "text-clipping-mutated-source-changed");
      inconclusiveTargets.add(snapshot.range);
      continue;
    }
    if (foundRanges.has(snapshot.range)) continue;
    const resolution = resolveBoundaries(snapshot.range, options.document);
    const geometry = geometryFor(options.document, snapshot.range, snapshot.boundary);
    if (
      !resolution.boundaries.includes(snapshot.boundary) ||
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
    const hiddenExtent = Math.max(0, geometry.range.right - geometry.boundary.right);
    if (hiddenExtent <= epsilon) continue;
    const style = view.getComputedStyle(snapshot.boundary);
    const locator = locatorFor(snapshot.boundary);
    const textOwner = snapshot.range.parentElement;
    if (textOwner === null) {
      appendReason(inconclusiveReasons, "text-clipping-text-owner-unavailable");
      inconclusiveTargets.add(snapshot.range);
      continue;
    }
    const affectedRange = { locator: locatorFor(textOwner), preview: redactPreview(snapshot.range.data) };
    const existing = findings.get(snapshot.boundary);
    foundRanges.add(snapshot.range);
    if (existing !== undefined) {
      findings.set(snapshot.boundary, {
        ...existing,
        affectedRanges: [...existing.affectedRanges, affectedRange],
        baseline: { visibleExtent: Math.max(existing.baseline.visibleExtent, snapshot.visibleExtent) },
        measuredDelta: Math.max(existing.measuredDelta, hiddenExtent),
        mutated: { hiddenExtent: Math.max(existing.mutated.hiddenExtent, hiddenExtent) },
      });
      continue;
    }
    findings.set(snapshot.boundary, {
      detectorId: "text-clipping",
      clippedAxis: "horizontal",
      locator,
      affectedRange,
      affectedRanges: [affectedRange],
      textOwner: { locator: locatorFor(textOwner) },
      baseline: { visibleExtent: snapshot.visibleExtent },
      mutated: { hiddenExtent },
      measuredDelta: hiddenExtent,
      computedStyles: { overflowX: style.overflowX, whiteSpace: style.whiteSpace },
      possibleCause: `${locator} has overflow-x: ${style.overflowX} while the affected text exceeds its right boundary.`,
    });
  }
  for (const target of options.targets) {
    if (knownRanges.has(target) || !target.isConnected) continue;
    const owner = target.parentElement;
    const range = rangeRect(options.document, target);
    if (
      owner !== null &&
      range !== null &&
      range.right > owner.getBoundingClientRect().right + epsilon &&
      owner.scrollWidth > owner.clientWidth + epsilon &&
      resolveBoundaries(target, options.document).boundaries.length === 0
    ) {
      appendReason(inconclusiveReasons, "text-clipping-boundary-unisolated");
      inconclusiveTargets.add(target);
    }
  }
  return {
    excludedTargets: options.baseline.excludedTargets,
    findings: [...findings.values()],
    inconclusiveReasons,
    inconclusiveTargets: inconclusiveTargets.size + options.baseline.inconclusiveTargets,
  };
}
