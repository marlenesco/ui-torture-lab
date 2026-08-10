// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";

test("Engine Run reports Unbreakable Text beyond its nearest containing boundary", async ({ page }) => {
  await page.goto("/horizontal-containment-run/");
  const result = await page.evaluate(async () => {
    type Controller = {
      getSnapshot(): { readonly result: { readonly findings: readonly unknown[] } | null };
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
    controller.restore();
    return controller.getSnapshot().result;
  });

  expect(result?.findings).toContainEqual(
    expect.objectContaining({
      detectorId: "horizontal-containment-overflow",
      locator: "div#containing-boundary",
      scenarioId: "unbreakable-text",
    }),
  );
});

test("Engine Run aggregates block, flex, and grid containment Evidence", async ({ page }) => {
  await page.goto("/horizontal-containment-run/");
  const findings = await page.evaluate(async () => {
    type Finding = { readonly affectedElementCount: number; readonly locator: string };
    type Controller = {
      getSnapshot(): { readonly result: { readonly findings: readonly Finding[] } | null };
      restore(): void;
      startScenario(scenarioId: "unbreakable-text"): Promise<void>;
    };
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: { readonly document: Document; readonly isExtensionOwnedNode: (node: Node) => boolean }): Controller;
    };
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    await controller.startScenario("unbreakable-text");
    controller.restore();
    return controller.getSnapshot().result?.findings;
  });

  expect(findings).toContainEqual(expect.objectContaining({ affectedElementCount: 2, locator: "div#aggregate-boundary" }));
  expect(findings).toContainEqual(expect.objectContaining({ locator: "div#flex-boundary" }));
  expect(findings).toContainEqual(expect.objectContaining({ locator: "div#grid-boundary" }));
  expect(findings).toContainEqual(
    expect.objectContaining({ locator: "div#rtl-boundary", overflowSide: "inline-end" }),
  );
});

test("Engine Run leaves clipping, scrolling, ambiguous, and unisolated layouts inconclusive", async ({ page }) => {
  await page.goto("/horizontal-containment-run/");
  const result = await page.evaluate(async () => {
    type Controller = {
      getSnapshot(): {
        readonly coverage: { readonly inconclusiveTargets: number };
        readonly findings: readonly { readonly locator: string }[];
      };
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
    const snapshot = controller.getSnapshot();
    controller.restore();
    return snapshot;
  });

  expect(result.findings).not.toContainEqual(expect.objectContaining({ locator: "div#clipped-child-boundary" }));
  expect(result.findings).not.toContainEqual(expect.objectContaining({ locator: "div#scrolling-boundary" }));
  expect(result.findings).not.toContainEqual(expect.objectContaining({ locator: "div#ambiguous-boundary" }));
  expect(result.findings).not.toContainEqual(expect.objectContaining({ locator: "main" }));
  expect(result.coverage.inconclusiveTargets).toBeGreaterThan(0);
});

test("Engine Run marks a reparented overflowing element inconclusive instead of rematching it", async ({ page }) => {
  await page.goto("/horizontal-containment-run/");
  const result = await page.evaluate(async () => {
    const target = document.querySelector("#overflowing-element")?.firstChild;
    const descriptor = Object.getOwnPropertyDescriptor(CharacterData.prototype, "data");
    if (!(target instanceof Text) || descriptor?.get === undefined || descriptor.set === undefined) {
      throw new Error("Reparent fixture was unavailable");
    }
    const nativeGet = descriptor.get;
    const nativeSet = descriptor.set;
    Object.defineProperty(target, "data", {
      configurable: true,
      get() {
        return nativeGet.call(this) as string;
      },
      set(value: string) {
        nativeSet.call(this, value);
        this.parentElement?.replaceWith(document.createElement("p"));
      },
    });
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as {
      createRunController(options: {
        readonly document: Document;
        readonly isExtensionOwnedNode: (node: Node) => boolean;
      }): {
        getSnapshot(): {
          readonly coverage: { readonly inconclusiveTargets: number };
          readonly findings: readonly { readonly locator: string }[];
        };
        restore(): void;
        startScenario(scenarioId: "unbreakable-text"): Promise<void>;
      };
    };
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    await controller.startScenario("unbreakable-text");
    const snapshot = controller.getSnapshot();
    controller.restore();
    return snapshot;
  });

  expect(result.findings).not.toContainEqual(expect.objectContaining({ locator: "div#containing-boundary" }));
  expect(result.coverage.inconclusiveTargets).toBeGreaterThan(0);
});
