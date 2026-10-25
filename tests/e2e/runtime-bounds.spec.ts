// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";

for (const scenario of ["long-text", "unbreakable-text", "large-text"] as const) {
  for (const fixture of ["large-document", "dynamic-layout"] as const) {
    test(`${scenario} remains bounded on ${fixture} without attributing unstable geometry`, async ({ page }, info) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/${fixture}/`);
      const observation = await page.evaluate(async ({ scenario }) => {
        const moduleUrl = "/__engine__/index.js";
        const { createRunController } = await import(moduleUrl) as {
          createRunController(options: { document: Document; isExtensionOwnedNode(node: Node): boolean }): {
            startScenario(id: "long-text" | "unbreakable-text" | "large-text"): Promise<void>;
            restore(): void;
            getSnapshot(): { coverage: { eligibleTargets: number; inconclusiveTargets: number }; findings: readonly { locator: string }[]; result: { restore: { status: string } } };
          };
        };
        const controller = createRunController({ document, isExtensionOwnedNode: () => false });
        const started = performance.now();
        await controller.startScenario(scenario);
        const active = controller.getSnapshot();
        controller.restore();
        return { elapsed: performance.now() - started, coverage: active.coverage, findings: active.findings, restore: controller.getSnapshot().result.restore.status };
      }, { scenario });
      await info.attach("synthetic-runtime-metrics", { body: JSON.stringify(observation, null, 2), contentType: "application/json" });
      expect(observation.elapsed).toBeLessThan(8000);
      expect(observation.restore).toBe("restored");
      if (fixture === "large-document") {
        expect(observation.coverage.eligibleTargets).toBe(500);
        expect(observation.findings).toEqual([]);
      } else {
        expect(observation.coverage.inconclusiveTargets).toBeGreaterThan(0);
        expect(observation.findings).not.toContainEqual(expect.objectContaining({ locator: "div#unstable" }));
        expect(observation.findings).toContainEqual(expect.objectContaining({ locator: "div#stable" }));
      }
    });
  }
}
