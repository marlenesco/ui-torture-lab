// SPDX-License-Identifier: Apache-2.0

import {
  createStyleMutationRecord,
  type MutationRecord,
} from "../run/mutation-journal.js";
import {
  collectEligibleTextOwners,
  type TextScenarioPreparationOptions,
} from "./eligible-text.js";

const textScalingFactor = 2;
const minimumMeaningfulGraphemes = 1;
const replacedElementNames = new Set([
  "AUDIO",
  "CANVAS",
  "EMBED",
  "IFRAME",
  "IMG",
  "INPUT",
  "OBJECT",
  "VIDEO",
]);
const iconFontName =
  /(^|[\s"'-])(awesome|bootstrap-icons|dashicons|fluent|heroicons|icon|icons|icomoon|ionicons|lucide|material|octicons|remixicon|symbol|symbols)([\s"'-]|$)/iu;
const privateUseCharacter =
  /[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/u;

export type LargeTextMutation = MutationRecord<{
  readonly priority: string;
  readonly value: string;
}>;

export type LargeTextPreparationOptions = TextScenarioPreparationOptions;

type BaselineFont = {
  readonly fontFamily: string;
  readonly fontSize: string;
  readonly writingMode: string;
};

const readBaselineFont = (target: HTMLElement, view: Window): BaselineFont => {
  const style = view.getComputedStyle(target);
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    writingMode: style.writingMode,
  };
};

const scaledFontSize = (baseline: BaselineFont): string | null => {
  if (
    baseline.writingMode !== "horizontal-tb" ||
    iconFontName.test(baseline.fontFamily)
  ) {
    return null;
  }

  const match = /^(?<pixels>\d+(?:\.\d+)?)px$/u.exec(baseline.fontSize);
  const pixels = match?.groups?.pixels === undefined
    ? Number.NaN
    : Number(match.groups.pixels);
  if (!Number.isFinite(pixels) || pixels <= 0) {
    return null;
  }

  return `${pixels * textScalingFactor}px`;
};

const ownsPrivateUseText = (target: HTMLElement): boolean =>
  [...target.childNodes].some(
    (node) => node instanceof Text && privateUseCharacter.test(node.data),
  );

export function prepareLargeTextMutations(
  options: LargeTextPreparationOptions,
): Promise<LargeTextMutation[]> {
  const view = options.document.defaultView;
  if (view === null) {
    return Promise.resolve([]);
  }

  const candidates = collectEligibleTextOwners(
    options,
    minimumMeaningfulGraphemes,
  ).flatMap((target) => {
    if (replacedElementNames.has(target.tagName) || ownsPrivateUseText(target)) {
      return [];
    }
    try {
      return [{ baseline: readBaselineFont(target, view), target }];
    } catch {
      return [];
    }
  });

  return new Promise((resolve) => {
    view.requestAnimationFrame(() => {
      resolve(
        candidates.flatMap(({ baseline, target }) => {
          let appliedValue: string | null;
          try {
            const repeatedBaseline = readBaselineFont(target, view);
            if (baseline.fontSize !== repeatedBaseline.fontSize) {
              return [];
            }
            appliedValue = scaledFontSize(baseline);
          } catch {
            return [];
          }
          if (appliedValue === null) {
            return [];
          }

          return [
            createStyleMutationRecord({
              target,
              property: "font-size",
              appliedValue,
              appliedPriority: "important",
              isEffective: () => {
                const currentView = options.document.defaultView;
                return (
                  currentView !== null &&
                  currentView.getComputedStyle(target).fontSize === appliedValue
                );
              },
            }),
          ];
        }),
      );
    });
  });
}
