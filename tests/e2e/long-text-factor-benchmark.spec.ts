// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";

test("threefold content-derived expansion crosses the controlled wrap boundary", async ({
  page,
}) => {
  await page.goto("/long-text-factor/");

  const lineCounts = await page.evaluate(() => {
    const target = document.querySelector("#benchmark-target")?.firstChild;
    if (!(target instanceof Text)) {
      throw new Error("Benchmark Text was unavailable");
    }
    const source = target.data;
    const countLines = (factor: number): number => {
      target.data = Array.from({ length: factor }, () => source).join(" ");
      const range = document.createRange();
      range.selectNodeContents(target);
      return new Set(
        [...range.getClientRects()].map((rect) => Math.round(rect.top)),
      ).size;
    };

    return {
      baseline: countLines(1),
      double: countLines(2),
      quadruple: countLines(4),
      triple: countLines(3),
    };
  });

  expect(lineCounts).toEqual({
    baseline: 1,
    double: 1,
    quadruple: 2,
    triple: 2,
  });
});

test("threefold expansion creates more stress than twofold on the built official site", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 800 });
  await page.goto("/__site__/index.html");

  const measurements = await page.evaluate(async () => {
    type Controller = {
      restore(): void;
      startScenario(scenarioId: "long-text"): Promise<void>;
    };
    type EngineModule = {
      createRunController(options: {
        readonly document: Document;
        readonly isExtensionOwnedNode: (node: Node) => boolean;
      }): Controller;
    };
    const root = document.querySelector("main");
    if (root === null) {
      throw new Error("Official site main content was unavailable");
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const allTextNodes: Text[] = [];
    let current = walker.nextNode();
    while (current !== null) {
      if (current instanceof Text) {
        allTextNodes.push(current);
      }
      current = walker.nextNode();
    }
    const originals = allTextNodes.map((target) => target.data);
    const baselineHeight = root.getBoundingClientRect().height;

    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as EngineModule;
    const controller = engine.createRunController({
      document,
      isExtensionOwnedNode: () => false,
    });
    await controller.startScenario("long-text");
    const eligibleIndexes = allTextNodes.flatMap((target, index) =>
      target.data === originals[index] ? [] : [index],
    );
    const tripleHeight = root.getBoundingClientRect().height;
    controller.restore();

    const expandTwice = (original: string): string => {
      const leading = original.match(/^\s*/u)?.[0] ?? "";
      const withoutLeading = original.slice(leading.length);
      const trailing = withoutLeading.match(/\s*$/u)?.[0] ?? "";
      const meaningful = withoutLeading.slice(
        0,
        withoutLeading.length - trailing.length,
      );
      return `${leading}${meaningful} ${meaningful}${trailing}`;
    };
    for (const index of eligibleIndexes) {
      const target = allTextNodes[index];
      const original = originals[index];
      if (target !== undefined && original !== undefined) {
        target.data = expandTwice(original);
      }
    }
    const doubleHeight = root.getBoundingClientRect().height;
    for (const index of eligibleIndexes) {
      const target = allTextNodes[index];
      const original = originals[index];
      if (target !== undefined && original !== undefined) {
        target.data = original;
      }
    }

    return {
      baselineHeight,
      doubleHeight,
      restored: allTextNodes.every(
        (target, index) => target.data === originals[index],
      ),
      tripleHeight,
    };
  });

  expect(measurements.doubleHeight).toBeGreaterThan(
    measurements.baselineHeight,
  );
  expect(measurements.tripleHeight).toBeGreaterThan(measurements.doubleHeight);
  expect(measurements.restored).toBe(true);
});
