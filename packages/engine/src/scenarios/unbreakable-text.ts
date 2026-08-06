// SPDX-License-Identifier: Apache-2.0

import type { MutationRecord } from "../run/mutation-journal.js";
import {
  prepareEligibleTextMutations,
  splitEligibleTextValue,
  type TextScenarioPreparationOptions,
} from "./eligible-text.js";

const canonicalUnbreakableToken =
  "UTL0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxy";
const minimumMeaningfulGraphemes = 1;

export type UnbreakableTextMutation = MutationRecord<string>;
export type UnbreakableTextPreparationOptions = TextScenarioPreparationOptions;

export function appendUnbreakableText(originalValue: string): string | null {
  const parts = splitEligibleTextValue(
    originalValue,
    minimumMeaningfulGraphemes,
  );
  if (parts === null) {
    return null;
  }

  return `${parts.leadingWhitespace}${parts.meaningfulValue} ${canonicalUnbreakableToken}${parts.trailingWhitespace}`;
}

export function prepareUnbreakableTextMutations(
  options: UnbreakableTextPreparationOptions,
): UnbreakableTextMutation[] {
  return prepareEligibleTextMutations(options, {
    minimumMeaningfulGraphemes,
    transform: (parts) =>
      `${parts.leadingWhitespace}${parts.meaningfulValue} ${canonicalUnbreakableToken}${parts.trailingWhitespace}`,
  });
}
