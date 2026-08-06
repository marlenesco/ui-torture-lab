// SPDX-License-Identifier: Apache-2.0

import {
  createTextMutationRecord,
  type MutationRecord,
} from "../run/mutation-journal.js";

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

export type TextScenarioPreparationOptions = {
  readonly document: Document;
  readonly isExtensionOwnedNode: (node: Node) => boolean;
};

export type TextValueParts = {
  readonly leadingWhitespace: string;
  readonly meaningfulValue: string;
  readonly trailingWhitespace: string;
};

const countGraphemes = (value: string): number =>
  [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(value)]
    .length;

export function splitEligibleTextValue(
  originalValue: string,
  minimumMeaningfulGraphemes: number,
): TextValueParts | null {
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

  return { leadingWhitespace, meaningfulValue, trailingWhitespace };
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

export function prepareEligibleTextMutations(
  options: TextScenarioPreparationOptions,
  rules: {
    readonly minimumMeaningfulGraphemes: number;
    readonly transform: (parts: TextValueParts) => string;
  },
): MutationRecord<string>[] {
  const root = options.document.body ?? options.document.documentElement;
  const walker = options.document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const records: MutationRecord<string>[] = [];
  let current = walker.nextNode();

  while (current !== null) {
    const target = current as Text;
    const parts = splitEligibleTextValue(
      target.data,
      rules.minimumMeaningfulGraphemes,
    );
    if (
      parts !== null &&
      target.isConnected &&
      target.ownerDocument === options.document &&
      !options.isExtensionOwnedNode(target) &&
      hasSupportedTextOwner(target) &&
      isRenderedNormalText(target, options.document)
    ) {
      records.push(
        createTextMutationRecord({
          target,
          appliedValue: rules.transform(parts),
        }),
      );
    }
    current = walker.nextNode();
  }

  return records;
}
