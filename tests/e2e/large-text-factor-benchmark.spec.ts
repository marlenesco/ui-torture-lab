// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";

test("twofold Large Text scaling is the smallest controlled candidate that reflows", async ({
  page,
}) => {
  await page.goto("/large-text-factor/");

  const lineCounts = await page.$eval("#benchmark-target", (target) => {
    if (!(target instanceof HTMLElement)) {
      throw new Error("Benchmark target was unavailable");
    }
    const countLines = (factor: number): number => {
      target.style.setProperty("font-size", `${20 * factor}px`, "important");
      const range = document.createRange();
      range.selectNodeContents(target);
      return new Set(
        [...range.getClientRects()].map((rect) => Math.round(rect.top)),
      ).size;
    };

    return {
      baseline: countLines(1),
      oneAndAHalf: countLines(1.5),
      two: countLines(2),
    };
  });

  expect(lineCounts).toEqual({
    baseline: 1,
    oneAndAHalf: 1,
    two: 2,
  });
});
