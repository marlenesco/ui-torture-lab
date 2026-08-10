// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";

test("Engine Run reports Long Text clipping against its nearest proven boundary", async ({
  page,
}) => {
  await page.goto("/text-clipping-run/");

  const result = await page.evaluate(async () => {
    type Controller = {
      getSnapshot(): { readonly result: { readonly findings: readonly unknown[] } | null };
      restore(): void;
      startScenario(scenarioId: "long-text"): Promise<void>;
    };
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: {
        readonly document: Document;
        readonly isExtensionOwnedNode: (node: Node) => boolean;
      }): Controller;
    };
    const controller = engine.createRunController({
      document,
      isExtensionOwnedNode: () => false,
    });
    await controller.startScenario("long-text");
    controller.restore();
    return controller.getSnapshot().result;
  });

  expect(result?.findings).toContainEqual(
    expect.objectContaining({
      affectedRange: expect.objectContaining({ locator: "p#clipping-boundary" }),
      baseline: expect.objectContaining({ visibleExtent: expect.any(Number) }),
      clippedAxis: "horizontal",
      detectorId: "text-clipping",
      locator: "p#clipping-boundary",
      mutated: expect.objectContaining({ hiddenExtent: expect.any(Number) }),
      possibleCause: expect.stringContaining("overflow-x"),
    }),
  );
});

test("Engine Run excludes intentional and pre-existing clipping", async ({ page }) => {
  await page.goto("/text-clipping-run/");

  const result = await page.evaluate(async () => {
    type Controller = {
      getSnapshot(): { readonly result: { readonly findings: readonly unknown[] } | null };
      restore(): void;
      startScenario(scenarioId: "long-text"): Promise<void>;
    };
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: {
        readonly document: Document;
        readonly isExtensionOwnedNode: (node: Node) => boolean;
      }): Controller;
    };
    const controller = engine.createRunController({
      document,
      isExtensionOwnedNode: () => false,
    });
    await controller.startScenario("long-text");
    controller.restore();
    return controller.getSnapshot().result;
  });

  expect(result?.findings).toHaveLength(3);
  expect(result?.findings).not.toContainEqual(
    expect.objectContaining({ locator: "p#ellipsis-boundary" }),
  );
  expect(result?.findings).not.toContainEqual(
    expect.objectContaining({ locator: "p#line-clamp-boundary" }),
  );
  expect(result?.findings).not.toContainEqual(
    expect.objectContaining({ locator: "p#preexisting-boundary" }),
  );
});

test("Engine Run marks a replaced clipping target inconclusive instead of rematching", async ({
  page,
}) => {
  await page.goto("/text-clipping-run/");

  const result = await page.evaluate(async () => {
    type Controller = {
      getSnapshot(): {
        readonly result: {
          readonly findings: readonly unknown[];
          readonly inconclusiveReasons: readonly string[];
        } | null;
      };
      restore(): void;
      startScenario(scenarioId: "long-text"): Promise<void>;
    };
    const boundary = document.querySelector("#clipping-boundary");
    if (!(boundary instanceof HTMLElement)) {
      throw new Error("Clipping boundary was unavailable");
    }
    const observer = new MutationObserver(() => {
      boundary.replaceChildren("Externally replaced");
      observer.disconnect();
    });
    observer.observe(boundary, { characterData: true, childList: true, subtree: true });
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: {
        readonly document: Document;
        readonly isExtensionOwnedNode: (node: Node) => boolean;
      }): Controller;
    };
    const controller = engine.createRunController({
      document,
      isExtensionOwnedNode: () => false,
    });
    await controller.startScenario("long-text");
    controller.restore();
    return controller.getSnapshot().result;
  });

  expect(result?.findings).not.toContainEqual(
    expect.objectContaining({ locator: "p#clipping-boundary" }),
  );
  expect(result?.inconclusiveReasons).toContain(
    "text-clipping-target-replaced-or-disconnected",
  );
});

test("Engine Run aggregates multiple affected ranges under one clipping boundary", async ({
  page,
}) => {
  await page.goto("/text-clipping-run/");
  const finding = await page.evaluate(async () => {
    type Controller = {
      getSnapshot(): { readonly result: { readonly findings: readonly { readonly locator: string }[] } | null };
      restore(): void;
      startScenario(scenarioId: "long-text"): Promise<void>;
    };
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: {
        readonly document: Document;
        readonly isExtensionOwnedNode: (node: Node) => boolean;
      }): Controller;
    };
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    await controller.startScenario("long-text");
    controller.restore();
    return controller
      .getSnapshot()
      .result?.findings.find((candidate) => candidate.locator === "p#aggregate-boundary");
  });
  expect(finding).toMatchObject({
    affectedRanges: [expect.any(Object), expect.any(Object)],
    locator: "p#aggregate-boundary",
  });
});

test("Engine Run marks changing baseline geometry inconclusive", async ({ page }) => {
  await page.goto("/text-clipping-run/");
  const result = await page.evaluate(async () => {
    const boundary = document.querySelector("#clipping-boundary");
    if (!(boundary instanceof HTMLElement)) throw new Error("Clipping boundary was unavailable");
    let width = 170;
    const animate = () => {
      width = width === 170 ? 169 : 170;
      boundary.style.width = `${width}px`;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    type Controller = {
      getSnapshot(): { readonly result: { readonly inconclusiveReasons: readonly string[] } | null };
      restore(): void;
      startScenario(scenarioId: "long-text"): Promise<void>;
    };
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: {
        readonly document: Document;
        readonly isExtensionOwnedNode: (node: Node) => boolean;
      }): Controller;
    };
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    await controller.startScenario("long-text");
    controller.restore();
    return controller.getSnapshot().result;
  });
  expect(result?.inconclusiveReasons).toContain("text-clipping-baseline-unstable");
});

test("Engine Run suppresses a farther boundary already explained by the nearest one", async ({
  page,
}) => {
  await page.goto("/text-clipping-run/");
  const findings = await page.evaluate(async () => {
    type Controller = {
      getSnapshot(): { readonly result: { readonly findings: readonly { readonly locator: string }[] } | null };
      restore(): void;
      startScenario(scenarioId: "long-text"): Promise<void>;
    };
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: {
        readonly document: Document;
        readonly isExtensionOwnedNode: (node: Node) => boolean;
      }): Controller;
    };
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    await controller.startScenario("long-text");
    controller.restore();
    return controller.getSnapshot().result?.findings;
  });
  expect(findings).toContainEqual(expect.objectContaining({ locator: "p#nested-inner" }));
  expect(findings).not.toContainEqual(expect.objectContaining({ locator: "div#nested-outer" }));
});
