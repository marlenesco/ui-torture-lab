// SPDX-License-Identifier: Apache-2.0

const expansionFactor = 3;
const minimumMeaningfulGraphemes = 2;
const structuredWhiteSpaceValues = new Set([
  "break-spaces",
  "pre",
  "pre-line",
  "pre-wrap",
]);
const excludedTextOwnerSelector = [
  "[aria-hidden='true']",
  "[contenteditable]:not([contenteditable='false'])",
  "code",
  "i",
  "kbd",
  "noscript",
  "pre",
  "samp",
  "script",
  "style",
  "svg",
  "template",
  "textarea",
  "[role='img']",
].join(",");

export type LongTextMutation = {
  readonly appliedValue: string;
  readonly originalValue: string;
  readonly target: Text;
};

export type LongTextPreparationOptions = {
  readonly document: Document;
  readonly isExtensionOwnedNode: (node: Node) => boolean;
};

const countGraphemes = (value: string): number =>
  [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(value)]
    .length;

export function expandLongText(originalValue: string): string | null {
  const leadingWhitespace = originalValue.match(/^\s*/u)?.[0] ?? "";
  const withoutLeading = originalValue.slice(leadingWhitespace.length);
  const trailingWhitespace = withoutLeading.match(/\s*$/u)?.[0] ?? "";
  const meaningfulValue = withoutLeading.slice(
    0,
    withoutLeading.length - trailingWhitespace.length,
  );

  if (countGraphemes(meaningfulValue) < minimumMeaningfulGraphemes) {
    return null;
  }

  return `${leadingWhitespace}${Array.from(
    { length: expansionFactor },
    () => meaningfulValue,
  ).join(" ")}${trailingWhitespace}`;
}

const hasSupportedTextOwner = (target: Text): boolean => {
  const owner = target.parentElement;
  if (owner === null || owner.closest(excludedTextOwnerSelector) !== null) {
    return false;
  }

  const identity = `${owner.id} ${owner.className}`.toLowerCase();
  return !/(^|[\s_-])(icon|glyph|symbol)([\s_-]|$)/u.test(identity);
};

const isRenderedNormalText = (
  target: Text,
  targetDocument: Document,
): boolean => {
  const owner = target.parentElement;
  const view = targetDocument.defaultView;
  if (owner === null || view === null) {
    return false;
  }
  const style = view.getComputedStyle(owner);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.visibility === "collapse" ||
    structuredWhiteSpaceValues.has(style.whiteSpace)
  ) {
    return false;
  }
  const range = targetDocument.createRange();
  range.selectNodeContents(target);
  return range.getClientRects().length > 0;
};

export function prepareLongTextMutations(
  options: LongTextPreparationOptions,
): LongTextMutation[] {
  const root = options.document.body ?? options.document.documentElement;
  const walker = options.document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const records: LongTextMutation[] = [];
  let current = walker.nextNode();

  while (current !== null) {
    const target = current as Text;
    const appliedValue = expandLongText(target.data);
    if (
      appliedValue !== null &&
      target.isConnected &&
      target.ownerDocument === options.document &&
      !options.isExtensionOwnedNode(target) &&
      hasSupportedTextOwner(target) &&
      isRenderedNormalText(target, options.document)
    ) {
      records.push({
        target,
        originalValue: target.data,
        appliedValue,
      });
    }
    current = walker.nextNode();
  }

  return records;
}
