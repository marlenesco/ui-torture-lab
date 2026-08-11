// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";

test("Engine Run reports Long Text clipping against its nearest proven boundary", async ({
  page,
}) => {
  await page.goto("/text-clipping-run/");

  const result = await page.evaluate(async () => {
    type Controller = {
      getSnapshot(): {
        readonly result: {
          readonly coverage: { readonly excludedTargets: number };
          readonly findings: readonly unknown[];
        } | null;
      };
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
  expect(result?.findings).toContainEqual(
    expect.objectContaining({ clippedAxis: "horizontal", locator: "p#clip-boundary" }),
  );
});

test("Engine Run redacts obvious secrets from retained Text Clipping previews", async ({ page }) => {
  await page.goto("/text-clipping-run/");
  await page.locator("main").evaluate((main) => {
    const element = document.createElement("p");
    element.id = "secret-boundary";
    element.style.cssText = "font-size: 1px; overflow: hidden; white-space: nowrap; width: 60px";
    element.textContent = "password=hunter2 Bearer eyJhbGciOiJIUzI1NiJ9.secret";
    main.append(element);
  });

  const result = await page.evaluate(async () => {
    type Controller = {
      getSnapshot(): { readonly result: { readonly findings: readonly { readonly affectedRange?: { readonly preview: string }; readonly locator: string }[] } | null };
      restore(): void;
      startScenario(scenarioId: "long-text"): Promise<void>;
    };
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: { readonly document: Document; readonly isExtensionOwnedNode: (node: Node) => boolean }): Controller;
    };
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    await controller.startScenario("long-text");
    controller.restore();
    return controller.getSnapshot().result;
  });

  const preview = result?.findings.find((finding) => finding.locator === "p#secret-boundary")?.affectedRange?.preview;
  expect(preview).toContain("[redacted-secret]");
  expect(preview).not.toContain("hunter2");
  expect(preview).not.toContain("eyJhbGciOiJIUzI1NiJ9.secret");
});

test("Engine Run excludes intentional and pre-existing clipping", async ({ page }) => {
  await page.goto("/text-clipping-run/");

  const result = await page.evaluate(async () => {
    type Controller = {
      getSnapshot(): {
        readonly result: {
          readonly coverage: { readonly excludedTargets: number };
          readonly findings: readonly unknown[];
        } | null;
      };
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

  expect(result?.findings).not.toContainEqual(
    expect.objectContaining({ locator: "p#ellipsis-boundary" }),
  );
  expect(result?.findings).not.toContainEqual(
    expect.objectContaining({ locator: "p#line-clamp-boundary" }),
  );
  expect(result?.findings).not.toContainEqual(
    expect.objectContaining({ locator: "p#preexisting-boundary" }),
  );
  expect(result?.findings).not.toContainEqual(
    expect.objectContaining({ locator: "p#preexisting-ellipsis" }),
  );
  expect(result?.findings).not.toContainEqual(
    expect.objectContaining({ locator: "p#preexisting-line-clamp" }),
  );
  expect(result?.coverage.excludedTargets).toBe(7);
});

test("Engine Run keeps an unisolatable boundary inconclusive", async ({ page }) => {
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

  expect(result?.findings).not.toContainEqual(
    expect.objectContaining({ locator: "p#unisolated-boundary" }),
  );
  expect(result?.inconclusiveReasons).toContain("text-clipping-boundary-unisolated");
});

test("Engine Run excludes truncation activated by Long Text from Findings", async ({ page }) => {
  await page.goto("/text-clipping-run/");
  const result = await page.evaluate(async () => {
    type Controller = {
      getSnapshot(): {
        readonly result: {
          readonly coverage: { readonly excludedTargets: number };
          readonly findings: readonly { readonly locator: string }[];
        } | null;
      };
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

  expect(result?.findings).not.toContainEqual(
    expect.objectContaining({ locator: "p#dynamic-ellipsis" }),
  );
  expect(result?.coverage.excludedTargets).toBe(7);
});

test("Engine Run does not exclude an inert multiline line-clamp configuration", async ({ page }) => {
  await page.goto("/text-clipping-run/");
  const findings = await page.evaluate(async () => {
    type Finding = { readonly clippedAxis: string; readonly locator: string };
    type Controller = {
      getSnapshot(): { readonly result: { readonly findings: readonly Finding[] } | null };
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

  expect(findings).toContainEqual(
    expect.objectContaining({ clippedAxis: "vertical", locator: "p#inert-line-clamp" }),
  );
});

test("Engine Run preserves every wrapped text fragment as range-level Evidence", async ({ page }) => {
  await page.goto("/text-clipping-run/");
  const finding = await page.evaluate(async () => {
    type SupportingRange = {
      readonly baselineRects: readonly unknown[];
      readonly mutatedRects: readonly unknown[];
    };
    type Finding = {
      readonly affectedRange: SupportingRange;
      readonly clippedAxis: string;
      readonly locator: string;
    };
    type Controller = {
      getSnapshot(): { readonly result: { readonly findings: readonly Finding[] } | null };
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
      .result?.findings.find((candidate) => candidate.locator === "p#wrapped-boundary");
  });

  expect(finding).toMatchObject({ clippedAxis: "vertical", locator: "p#wrapped-boundary" });
  expect(finding?.affectedRange.baselineRects).toHaveLength(1);
  expect(finding?.affectedRange.mutatedRects.length).toBeGreaterThan(1);
});

test("Engine Run attributes parent and distant clipping boundaries without guessing", async ({ page }) => {
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

  expect(findings).toContainEqual(expect.objectContaining({ locator: "div#parent-boundary" }));
  expect(findings).toContainEqual(expect.objectContaining({ locator: "div#distant-boundary" }));
});

test("Engine Run keeps anonymous clipping boundaries distinct by DOM identity", async ({ page }) => {
  await page.goto("/text-clipping-run/");
  const findings = await page.evaluate(async () => {
    type Finding = { readonly affectedRanges: readonly unknown[]; readonly locator: string };
    type Controller = {
      getSnapshot(): { readonly result: { readonly findings: readonly Finding[] } | null };
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
      .result?.findings.filter((candidate) => candidate.locator === "div");
  });

  expect(findings).toHaveLength(2);
  expect(findings).toEqual([
    expect.objectContaining({ affectedRanges: [expect.any(Object)] }),
    expect.objectContaining({ affectedRanges: [expect.any(Object)] }),
  ]);
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
    affectedRanges: [
      expect.objectContaining({ locator: "p#aggregate-boundary" }),
      expect.objectContaining({ locator: "strong" }),
    ],
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

test("Engine Run reports vertical clipping and leaves visible overflow unreported", async ({
  page,
}) => {
  await page.goto("/text-clipping-run/");
  const findings = await page.evaluate(async () => {
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
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    await controller.startScenario("long-text");
    controller.restore();
    return controller.getSnapshot().result?.findings;
  });
  expect(findings).toContainEqual(
    expect.objectContaining({ clippedAxis: "vertical", locator: "p#vertical-boundary" }),
  );
  expect(findings).not.toContainEqual(
    expect.objectContaining({ locator: "p#visible-overflow" }),
  );
  expect(findings).not.toContainEqual(
    expect.objectContaining({ locator: "p#x-only-boundary" }),
  );
  expect(findings).not.toContainEqual(
    expect.objectContaining({ locator: "p#y-only-boundary" }),
  );
});

test("Engine Run emits distinct Evidence for independently proven clipping axes", async ({ page }) => {
  await page.goto("/text-clipping-run/");
  const findings = await page.evaluate(async () => {
    type Finding = { readonly affectedRanges: readonly unknown[]; readonly clippedAxis: string; readonly locator: string };
    type Controller = {
      getSnapshot(): { readonly result: { readonly findings: readonly Finding[] } | null };
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
    return controller.getSnapshot().result?.findings.filter(
      (candidate) => candidate.locator === "p#two-axis-boundary",
    );
  });

  expect(findings).toEqual([
    expect.objectContaining({ affectedRanges: [expect.any(Object)], clippedAxis: "horizontal" }),
    expect.objectContaining({ affectedRanges: [expect.any(Object)], clippedAxis: "vertical" }),
  ]);
});

test("Engine Run keeps independently proven nested clipping mechanisms separate", async ({ page }) => {
  await page.goto("/text-clipping-run/");
  const findings = await page.evaluate(async () => {
    type Finding = { readonly clippedAxis: string; readonly locator: string };
    type Controller = {
      getSnapshot(): { readonly result: { readonly findings: readonly Finding[] } | null };
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
    return controller.getSnapshot().result?.findings.filter(
      (candidate) => candidate.locator.includes("nested-independent"),
    );
  });

  expect(findings).toContainEqual(
    expect.objectContaining({ clippedAxis: "horizontal", locator: "p#nested-independent-inner" }),
  );
  expect(findings).toContainEqual(
    expect.objectContaining({ clippedAxis: "vertical", locator: "div#nested-independent-outer" }),
  );
  expect(findings).not.toContainEqual(
    expect.objectContaining({ clippedAxis: "horizontal", locator: "div#nested-independent-outer" }),
  );
});

test("Engine Run keeps a farther same-axis boundary only for its additional hidden portion", async ({ page }) => {
  await page.goto("/text-clipping-run/");
  const findings = await page.evaluate(async () => {
    type Finding = { readonly clippedAxis: string; readonly locator: string; readonly measuredDelta: number };
    type Controller = {
      getSnapshot(): { readonly result: { readonly findings: readonly Finding[] } | null };
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
    return controller.getSnapshot().result?.findings.filter(
      (candidate) => candidate.locator.includes("nested-same-axis"),
    );
  });

  expect(findings).toEqual([
    expect.objectContaining({ clippedAxis: "horizontal", locator: "p#nested-same-axis-inner" }),
    expect.objectContaining({ clippedAxis: "horizontal", locator: "div#nested-same-axis-outer" }),
  ]);
  expect(findings?.[1]?.measuredDelta).toBeLessThan(findings?.[0]?.measuredDelta ?? Infinity);
});

test("Engine Run suppresses an outer boundary already hidden by intentional truncation", async ({ page }) => {
  await page.goto("/text-clipping-run/");
  const findings = await page.evaluate(async () => {
    type Finding = { readonly locator: string };
    type Controller = {
      getSnapshot(): { readonly result: { readonly findings: readonly Finding[] } | null };
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

  expect(findings).not.toContainEqual(
    expect.objectContaining({ locator: "p#nested-explicit-inner" }),
  );
  expect(findings).not.toContainEqual(
    expect.objectContaining({ locator: "div#nested-explicit-outer" }),
  );
});

test("Engine Run excludes an outer boundary around already-active intentional truncation", async ({ page }) => {
  await page.goto("/text-clipping-run/");
  const findings = await page.evaluate(async () => {
    type Finding = { readonly locator: string };
    type Controller = {
      getSnapshot(): { readonly result: { readonly findings: readonly Finding[] } | null };
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

  expect(findings).not.toContainEqual(
    expect.objectContaining({ locator: "div#preexisting-nested-explicit-outer" }),
  );
});

test("Engine Run orders Text Clipping magnitude deterministically", async ({ page }) => {
  await page.goto("/text-clipping-run/");
  const findings = await page.evaluate(async () => {
    type Finding = { readonly detectorId: string; readonly measuredDelta: number };
    type Controller = {
      getSnapshot(): { readonly result: { readonly findings: readonly Finding[] } | null };
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
    return controller.getSnapshot().result?.findings
      .filter((finding) => finding.detectorId === "text-clipping")
      .map(({ measuredDelta }) => measuredDelta);
  });
  expect(findings).toEqual([...findings ?? []].sort((a, b) => b - a));
});
