// SPDX-License-Identifier: Apache-2.0

import type { MutationRecord } from "../run/mutation-journal.js";
import {
  prepareEligibleTextMutations,
  splitEligibleTextValue,
  type TextScenarioPreparationOptions,
} from "./eligible-text.js";

const expansionFactor = 3;
const minimumMeaningfulGraphemes = 2;

export type LongTextMutation = MutationRecord<string>;

export type LongTextPreparationOptions = TextScenarioPreparationOptions;

export function expandLongText(originalValue: string): string | null {
  const parts = splitEligibleTextValue(
    originalValue,
    minimumMeaningfulGraphemes,
  );
  if (parts === null) {
    return null;
  }

  return `${parts.leadingWhitespace}${Array.from(
    { length: expansionFactor },
    () => parts.meaningfulValue,
  ).join(" ")}${parts.trailingWhitespace}`;
}

export function prepareLongTextMutations(
  options: LongTextPreparationOptions,
): LongTextMutation[] {
  return prepareEligibleTextMutations(options, {
    minimumMeaningfulGraphemes,
    transform: (parts) =>
      `${parts.leadingWhitespace}${Array.from(
        { length: expansionFactor },
        () => parts.meaningfulValue,
      ).join(" ")}${parts.trailingWhitespace}`,
  });
}
