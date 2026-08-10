// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";

test("Engine Run reports one Target Page Viewport Overflow with its primary contributor", async ({ page }) => {
  await page.goto("/horizontal-containment-run/");
  const result = await page.evaluate(async () => {
    type Controller = {
      getSnapshot(): { readonly findings: readonly unknown[] };
      restore(): void;
      startScenario(scenarioId: "unbreakable-text"): Promise<void>;
    };
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: {
        readonly document: Document;
        readonly isExtensionOwnedNode: (node: Node) => boolean;
      }): Controller;
    };
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    await controller.startScenario("unbreakable-text");
    const findings = controller.getSnapshot().findings;
    controller.restore();
    return { findings };
  });

  const viewportFindings = result.findings.filter(
    (finding) =>
      typeof finding === "object" &&
      finding !== null &&
      "detectorId" in finding &&
      finding.detectorId === "viewport-overflow",
  );
  expect(result).toMatchObject({ findings: expect.arrayContaining([expect.objectContaining({ detectorId: "viewport-overflow" })]) });
  expect(viewportFindings).toHaveLength(1);
  expect(viewportFindings[0]).toEqual(
    expect.objectContaining({
      detectorId: "viewport-overflow",
      locator: "target-page",
      primaryContributor: expect.objectContaining({ locator: "p#viewport-child" }),
      scenarioId: "unbreakable-text",
    }),
  );
});

test("Viewport Overflow uses the stable standards-mode root viewport and widest body or root extent", async ({ page }) => {
  await page.goto("/horizontal-containment-run/");
  const observation = await page.evaluate(async () => {
    type Finding = {
      readonly detectorId: string;
      readonly mutated: { readonly documentExtent: number; readonly viewportWidth: number };
    };
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: {
        readonly document: Document;
        readonly isExtensionOwnedNode: (node: Node) => boolean;
      }): {
        getSnapshot(): { readonly findings: readonly Finding[] };
        restore(): void;
        startScenario(scenarioId: "unbreakable-text"): Promise<void>;
      };
    };
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    await controller.startScenario("unbreakable-text");
    const finding = controller.getSnapshot().findings.find(
      (candidate) => candidate.detectorId === "viewport-overflow",
    );
    const root = document.documentElement;
    const body = document.body;
    const subpixelWidth = document.querySelector("#subpixel-boundary")?.getBoundingClientRect().width;
    const widestExtent = Math.max(
      root.clientWidth,
      root.offsetWidth,
      root.scrollWidth,
      body.clientWidth,
      body.offsetWidth,
      body.scrollWidth,
    );
    const rootViewportWidth = root.clientWidth;
    controller.restore();
    return {
      compatMode: document.compatMode,
      finding,
      widestExtent,
      rootViewportWidth,
      subpixelWidth,
    };
  });

  expect(observation.compatMode).toBe("CSS1Compat");
  expect(observation.subpixelWidth).toBeCloseTo(180.25, 1);
  expect(observation).toMatchObject({
    finding: expect.objectContaining({ mutated: expect.objectContaining({ viewportWidth: observation.rootViewportWidth }) }),
  });
  expect(observation.finding?.mutated.documentExtent).toBe(observation.widestExtent);
});

test("Viewport Overflow does not report when Unbreakable Text creates no new page excess", async ({ page }) => {
  await page.goto("/horizontal-containment-run/");
  const count = await page.evaluate(async () => {
    document.querySelector<HTMLElement>("#viewport-boundary")?.style.setProperty("margin-left", "0px");
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: { readonly document: Document; readonly isExtensionOwnedNode: (node: Node) => boolean }): {
        getSnapshot(): { readonly findings: readonly { readonly detectorId: string }[] };
        restore(): void;
        startScenario(scenarioId: "unbreakable-text"): Promise<void>;
      };
    };
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    await controller.startScenario("unbreakable-text");
    const findings = controller.getSnapshot().findings.filter((finding) => finding.detectorId === "viewport-overflow");
    controller.restore();
    return findings.length;
  });

  expect(count).toBe(0);
});

test("Viewport Overflow keeps document-coordinate contributor evidence after pre-existing horizontal scroll", async ({ page }) => {
  await page.goto("/horizontal-containment-run/");
  const observation = await page.evaluate(async () => {
    const preexisting = document.createElement("div");
    preexisting.style.cssText = "margin-left: 1400px; width: 1px; height: 1px";
    document.body.append(preexisting);
    window.scrollTo({ left: 120 });
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: { readonly document: Document; readonly isExtensionOwnedNode: (node: Node) => boolean }): {
        getSnapshot(): { readonly findings: readonly { readonly detectorId: string }[] };
        restore(): void;
        startScenario(scenarioId: "unbreakable-text"): Promise<void>;
      };
    };
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    await controller.startScenario("unbreakable-text");
    const found = controller.getSnapshot().findings.some((finding) => finding.detectorId === "viewport-overflow");
    controller.restore();
    return { found, scrollX: window.scrollX };
  });

  expect(observation.scrollX).toBeGreaterThan(0);
  expect(observation).toMatchObject({ found: true, scrollX: expect.any(Number) });
});

test("Viewport Overflow makes a contributor that gains unsupported geometry inconclusive", async ({ page }) => {
  await page.goto("/horizontal-containment-run/");
  const snapshot = await page.evaluate(async () => {
    const contributor = document.querySelector<HTMLElement>("#viewport-child");
    if (contributor === null) throw new Error("viewport contributor missing");
    const observer = new MutationObserver(() => {
      contributor.style.transform = "translateX(1px)";
      observer.disconnect();
    });
    observer.observe(contributor, { characterData: true, childList: true, subtree: true });
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: { readonly document: Document; readonly isExtensionOwnedNode: (node: Node) => boolean }): {
        getSnapshot(): {
          readonly findings: readonly { readonly detectorId: string }[];
          readonly result: { readonly inconclusiveReasons: readonly string[] } | null;
        };
        restore(): void;
        startScenario(scenarioId: "unbreakable-text"): Promise<void>;
      };
    };
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    await controller.startScenario("unbreakable-text");
    const findings = controller.getSnapshot().findings;
    controller.restore();
    return { findings, result: controller.getSnapshot().result };
  });

  expect(snapshot.findings.some((finding) => finding.detectorId === "viewport-overflow")).toBe(false);
  expect(snapshot.result?.inconclusiveReasons).toContain("viewport-overflow-contributor-geometry-unsupported");
});

test("Viewport Overflow never makes a local scrolling child the page contributor", async ({ page }) => {
  await page.goto("/horizontal-containment-run/");
  const primaryLocator = await page.evaluate(async () => {
    document.querySelector<HTMLElement>("#scrolling-boundary")?.style.setProperty("margin-left", "1300px");
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: { readonly document: Document; readonly isExtensionOwnedNode: (node: Node) => boolean }): {
        getSnapshot(): { readonly findings: readonly { readonly detectorId: string; readonly primaryContributor?: { readonly locator: string } }[] };
        restore(): void;
        startScenario(scenarioId: "unbreakable-text"): Promise<void>;
      };
    };
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    await controller.startScenario("unbreakable-text");
    const finding = controller.getSnapshot().findings.find((candidate) => candidate.detectorId === "viewport-overflow");
    controller.restore();
    return finding?.primaryContributor?.locator;
  });

  expect(primaryLocator).toBe("p#viewport-child");
});

test("Viewport Overflow never makes marquee fallback text the page contributor", async ({ page }) => {
  await page.goto("/horizontal-containment-run/");
  const primaryLocator = await page.evaluate(async () => {
    document.querySelector<HTMLElement>("#marquee-boundary")?.style.setProperty("margin-left", "1300px");
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: { readonly document: Document; readonly isExtensionOwnedNode: (node: Node) => boolean }): {
        getSnapshot(): { readonly findings: readonly { readonly detectorId: string; readonly primaryContributor?: { readonly locator: string } }[] };
        restore(): void;
        startScenario(scenarioId: "unbreakable-text"): Promise<void>;
      };
    };
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    await controller.startScenario("unbreakable-text");
    const finding = controller.getSnapshot().findings.find((candidate) => candidate.detectorId === "viewport-overflow");
    controller.restore();
    return finding?.primaryContributor?.locator;
  });

  expect(primaryLocator).toBe("p#viewport-child");
});
