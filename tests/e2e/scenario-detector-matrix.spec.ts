// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";

for (const scenarioId of ["long-text", "unbreakable-text", "large-text"] as const) {
  test(`${scenarioId} runs every eligible Detector through one comparable Run`, async ({ page }) => {
    await page.goto("/scenario-detector-matrix/");
    const result = await page.evaluate(async (scenario) => {
      const moduleUrl = "/__engine__/index.js";
      const engine = (await import(moduleUrl)) as {
        createRunController(options: {
          readonly document: Document;
          readonly isExtensionOwnedNode: (node: Node) => boolean;
        }): {
          getSnapshot(): {
            readonly coverage: Record<string, number>;
            readonly findings: readonly {
              readonly detectorId: string;
              readonly locator: string;
              readonly measuredDelta: number;
              readonly scenarioId: string;
            }[];
          };
          restore(): void;
          startScenario(id: "large-text" | "long-text" | "unbreakable-text"): Promise<void>;
        };
      };
      const controller = engine.createRunController({
        document,
        isExtensionOwnedNode: () => false,
      });
      await controller.startScenario(scenario);
      const snapshot = controller.getSnapshot();
      controller.restore();
      return snapshot;
    }, scenarioId);

    const detectorOrder = [
      "text-clipping",
      "horizontal-containment-overflow",
      "viewport-overflow",
    ];
    expect(new Set(result.findings.map((finding) => finding.detectorId))).toEqual(
      new Set(detectorOrder),
    );
    expect(result.findings.map((finding) => detectorOrder.indexOf(finding.detectorId))).toEqual(
      [...result.findings]
        .map((finding) => detectorOrder.indexOf(finding.detectorId))
        .sort((left, right) => left - right),
    );
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ locator: "div#clipping", scenarioId }),
      expect.objectContaining({ locator: "div#containment", scenarioId }),
      expect.objectContaining({ locator: "target-page", scenarioId }),
    ]));
    expect(result.findings).not.toContainEqual(expect.objectContaining({
      detectorId: "horizontal-containment-overflow",
      locator: "div#clipping",
    }));
    expect(result.findings.every((finding) => finding.measuredDelta > 0)).toBe(true);
    expect(result.coverage).toMatchObject({
      comparableTargets: expect.any(Number),
      contributorTargets: expect.any(Number),
      findingCount: result.findings.length,
      safeFailedTargets: 0,
    });
    expect(result.coverage.comparableTargets).toBeGreaterThan(0);
    expect(result.coverage.contributorTargets).toBeGreaterThan(0);
  });
}

test("RTL clipping stays inconclusive for containment instead of duplicating it", async ({ page }) => {
  await page.goto("/scenario-detector-matrix/");
  const findings = await page.evaluate(async () => {
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: {
        readonly document: Document;
        readonly isExtensionOwnedNode: (node: Node) => boolean;
      }): {
        getSnapshot(): { readonly findings: readonly { readonly detectorId: string; readonly locator: string }[] };
        restore(): void;
        startScenario(id: "unbreakable-text"): Promise<void>;
      };
    };
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    await controller.startScenario("unbreakable-text");
    const current = controller.getSnapshot().findings;
    controller.restore();
    return current;
  });

  expect(findings).not.toContainEqual(expect.objectContaining({
    detectorId: "horizontal-containment-overflow",
    locator: "div#rtl-clipping",
  }));
});

for (const scenarioId of ["long-text", "large-text"] as const) {
  test(`${scenarioId} has a valid no-Finding Viewport Overflow pairing`, async ({ page }) => {
    await page.goto("/scenario-detector-matrix/");
    const findings = await page.evaluate(async (scenario) => {
      const viewportTarget = document.querySelector<HTMLElement>("#viewport");
      if (viewportTarget === null) throw new Error("Matrix viewport target was unavailable");
      viewportTarget.style.setProperty("display", "none");
      const moduleUrl = "/__engine__/index.js";
      const engine = (await import(moduleUrl)) as {
        createRunController(options: {
          readonly document: Document;
          readonly isExtensionOwnedNode: (node: Node) => boolean;
        }): {
          getSnapshot(): { readonly findings: readonly { readonly detectorId: string }[] };
          restore(): void;
          startScenario(id: "large-text" | "long-text"): Promise<void>;
        };
      };
      const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
      await controller.startScenario(scenario);
      const current = controller.getSnapshot().findings;
      controller.restore();
      return current;
    }, scenarioId);

    expect(findings).not.toContainEqual(expect.objectContaining({
      detectorId: "viewport-overflow",
    }));
  });
}

test("Large Text makes autonomously changed style targets inconclusive", async ({ page }) => {
  await page.goto("/scenario-detector-matrix/");
  const snapshot = await page.evaluate(async () => {
    const target = document.querySelector<HTMLElement>("#clipping > p");
    if (target === null) throw new Error("Matrix clipping target was unavailable");
    const observer = new MutationObserver(() => {
      observer.disconnect();
      target.style.setProperty("font-size", "16px");
    });
    observer.observe(target, { attributes: true, attributeFilter: ["style"] });
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: {
        readonly document: Document;
        readonly isExtensionOwnedNode: (node: Node) => boolean;
      }): {
        getSnapshot(): {
          readonly coverage: { readonly inconclusiveTargets: number };
          readonly findings: readonly { readonly detectorId: string; readonly locator: string }[];
        };
        restore(): void;
        startScenario(id: "large-text"): Promise<void>;
      };
    };
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    await controller.startScenario("large-text");
    const current = controller.getSnapshot();
    controller.restore();
    return current;
  });

  expect(snapshot.findings).not.toContainEqual(
    expect.objectContaining({ detectorId: "text-clipping", locator: "div#clipping" }),
  );
  expect(snapshot.coverage.inconclusiveTargets).toBeGreaterThan(0);
});

test("coverage counts Large Text owners once when they own multiple Text nodes", async ({ page }) => {
  await page.goto("/scenario-detector-matrix/");
  const coverage = await page.evaluate(async () => {
    document.querySelector("#clipping > p")?.append(" again");
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: {
        readonly document: Document;
        readonly isExtensionOwnedNode: (node: Node) => boolean;
      }): {
        getSnapshot(): { readonly coverage: Record<string, number> };
        restore(): void;
        startScenario(id: "large-text"): Promise<void>;
      };
    };
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    await controller.startScenario("large-text");
    const current = controller.getSnapshot().coverage;
    controller.restore();
    return current;
  });

  expect(coverage.comparableTargets ?? 0).toBeLessThanOrEqual(coverage.mutatedTargets ?? 0);
  expect(coverage.contributorTargets ?? 0).toBeLessThanOrEqual(coverage.mutatedTargets ?? 0);
});

for (const scenarioId of ["long-text", "unbreakable-text", "large-text"] as const) {
  test(`${scenarioId} keeps intentional clipping excluded and suppresses duplicate containment`, async ({ page }) => {
    await page.goto("/scenario-detector-matrix/");
    const result = await page.evaluate(async (scenario) => {
      const boundary = document.querySelector<HTMLElement>("#clipping");
      if (boundary === null) throw new Error("Matrix clipping boundary was unavailable");
      boundary.style.setProperty("text-overflow", "ellipsis");
      const moduleUrl = "/__engine__/index.js";
      const engine = (await import(moduleUrl)) as {
        createRunController(options: {
          readonly document: Document;
          readonly isExtensionOwnedNode: (node: Node) => boolean;
        }): {
          getSnapshot(): { readonly findings: readonly { readonly detectorId: string; readonly locator: string }[] };
          restore(): void;
          startScenario(id: "large-text" | "long-text" | "unbreakable-text"): Promise<void>;
        };
      };
      const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
      await controller.startScenario(scenario);
      const findings = controller.getSnapshot().findings;
      controller.restore();
      return findings;
    }, scenarioId);

    expect(result).not.toContainEqual(expect.objectContaining({ locator: "div#clipping" }));
    expect(result).toContainEqual(expect.objectContaining({
      detectorId: "horizontal-containment-overflow",
      locator: "div#containment",
      scenarioId,
    }));
  });
}

test("a missing animation frame completes the Run as detector-local inconclusive", async ({ page }) => {
  await page.goto("/scenario-detector-matrix/");
  test.setTimeout(15_000);
  const observation = await page.evaluate(async () => {
    const original = window.requestAnimationFrame;
    window.requestAnimationFrame = () => 0;
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: {
        readonly document: Document;
        readonly isExtensionOwnedNode: (node: Node) => boolean;
      }): {
        getSnapshot(): {
          readonly phase: string;
          readonly result: { readonly inconclusiveReasons: readonly string[] } | null;
        };
        restore(): void;
        startScenario(id: "long-text"): Promise<void>;
      };
    };
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    const startedAt = performance.now();
    await controller.startScenario("long-text");
    const activePhase = controller.getSnapshot().phase;
    controller.restore();
    window.requestAnimationFrame = original;
    return { activePhase, elapsed: performance.now() - startedAt, result: controller.getSnapshot().result };
  });

  expect(observation.elapsed).toBeLessThan(10_000);
  expect(observation.activePhase).toBe("ready-for-inspection");
  expect(observation.result?.inconclusiveReasons).toEqual(expect.arrayContaining([
    "text-clipping-sampling-timeout",
    "horizontal-containment-sampling-timeout",
    "viewport-overflow-sampling-timeout",
  ]));
});
