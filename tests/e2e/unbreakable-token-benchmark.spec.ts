// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";

const canonicalToken =
  "UTL0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxy";
const shortCandidate = "UTL0123456789ABCDEFGHIJKLMNOPQRS";
const longCandidate = `${canonicalToken}${canonicalToken}`;

test("the selected 64-character token creates bounded generic horizontal stress", async ({
  page,
}) => {
  await page.goto("/unbreakable-token-factor/");

  const measurement = await page.$eval(
    "#benchmark-target",
    (target, candidates) => {
      const text = target.firstChild;
      if (!(text instanceof Text)) {
        throw new Error("Benchmark Text was unavailable");
      }
      const measure = (candidate: string): number => {
        text.data = candidate;
        const range = document.createRange();
        range.selectNodeContents(text);
        return range.getBoundingClientRect().width;
      };
      text.data = `Label ${candidates.selected}`;
      const range = document.createRange();
      range.setStart(text, "Label ".length);
      range.setEnd(text, text.length);
      const rects = [...range.getClientRects()];
      return {
        containerWidth: target.getBoundingClientRect().width,
        longWidth: measure(candidates.long),
        selectedWidth: measure(candidates.selected),
        shortWidth: measure(candidates.short),
        tokenRectCount: rects.length,
      };
    },
    {
      long: longCandidate,
      selected: canonicalToken,
      short: shortCandidate,
    },
  );

  expect(shortCandidate).toHaveLength(32);
  expect(canonicalToken).toHaveLength(64);
  expect(longCandidate).toHaveLength(128);
  expect(canonicalToken).toMatch(/^[A-Za-z0-9]+$/u);
  expect(measurement.tokenRectCount).toBe(1);
  expect(measurement.shortWidth).toBeLessThan(measurement.containerWidth);
  expect(measurement.selectedWidth).toBeGreaterThan(
    measurement.containerWidth,
  );
  expect(measurement.selectedWidth).toBeLessThan(800);
  expect(measurement.longWidth).toBeGreaterThan(measurement.selectedWidth);
});
