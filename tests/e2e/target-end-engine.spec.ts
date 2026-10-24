// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";

for (const scenario of ["long-text", "unbreakable-text", "large-text"] as const) {
  test(`${scenario} ends synchronously with verified Restore and non-live completed Evidence`, async ({ page }) => {
    await page.goto("/same-document-navigation/");
    const result = await page.evaluate(async (scenario) => {
      const moduleUrl = "/__engine__/index.js";
      const engine = await import(moduleUrl) as typeof import("../../packages/engine/src/index.js");
      const original = document.querySelector("#boundary")?.textContent;
      const style = document.querySelector("#boundary")?.getAttribute("style") ?? "";
      const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
      await controller.startScenario(scenario);
      const before = controller.getSnapshot();
      const result = controller.endTarget("same-document-navigation");
      const after = controller.getSnapshot();
      let blocked = "";
      try { await controller.startScenario(scenario); } catch (error) { blocked = String(error); }
      return {
        beforeFindings: before.findings,
        after,
        blocked,
        original,
        restored: document.querySelector("#boundary")?.textContent,
        style,
        restoredStyle: document.querySelector("#boundary")?.getAttribute("style") ?? "",
        live: before.findings.map((finding: Parameters<typeof controller.getLiveFindingReference>[0]) => controller.getLiveFindingReference(finding)),
        sameResult: result === controller.endTarget("same-document-navigation"),
      };
    }, scenario);
    expect(result.after.result).toMatchObject({ status: "completed", terminationReason: "same-document-navigation", restore: { status: "restored" } });
    expect(result.after.findings).toEqual(result.beforeFindings);
    expect(result.restored).toBe(result.original);
    expect(result.restoredStyle).toBe(result.style);
    expect(result.live.every((reference: unknown) => reference === null)).toBe(true);
    expect(result.blocked).toContain("new toolbar authorization");
    expect(result.sameResult).toBe(true);
  });

  test(`${scenario} cannot resume pending preparation after its Target Page ends`, async ({ page }) => {
    await page.goto("/same-document-navigation/");
    const result = await page.evaluate(async (scenario) => {
      const moduleUrl = "/__engine__/index.js";
      const engine = await import(moduleUrl) as typeof import("../../packages/engine/src/index.js");
      const original = document.querySelector("#boundary")?.textContent;
      const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
      const pending = controller.startScenario(scenario);
      const ended = controller.endTarget("same-document-navigation");
      await pending;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return { ended, after: controller.getSnapshot(), original, text: document.querySelector("#boundary")?.textContent, style: document.querySelector("#boundary")?.getAttribute("style") };
    }, scenario);
    expect(result.ended).toMatchObject({ status: "aborted", findings: [], terminationReason: "same-document-navigation", restore: { status: "restored" } });
    expect(result.after.result).toEqual(result.ended);
    expect(result.after.phase).toBe("aborted");
    expect(result.text).toBe(result.original);
    expect(result.style).toBeNull();
  });
}

test("ending during mutated measurement discards incomplete Evidence and restores applied text", async ({ page }) => {
  await page.goto("/same-document-navigation/");
  const result = await page.evaluate(async () => {
    const moduleUrl = "/__engine__/index.js";
      const engine = await import(moduleUrl) as typeof import("../../packages/engine/src/index.js");
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    const target = document.querySelector("#boundary");
    if (target === null) throw new Error("Fixture unavailable");
    const original = target.textContent;
    const observer = new MutationObserver(() => {
      observer.disconnect();
      controller.endTarget("same-document-navigation");
    });
    observer.observe(target, { characterData: true, subtree: true });
    await controller.startScenario("long-text");
    return { snapshot: controller.getSnapshot(), text: target.textContent, original };
  });
  expect(result.snapshot).toMatchObject({ phase: "aborted", result: { status: "aborted", findings: [], restore: { status: "restored" } } });
  expect(result.text).toBe(result.original);
});

test("reentrant Target Page invalidation during a write blocks later mutations and requires reload", async ({ page }) => {
  await page.goto("/same-document-navigation/");
  const result = await page.evaluate(async () => {
    const moduleUrl = "/__engine__/index.js";
      const engine = await import(moduleUrl) as typeof import("../../packages/engine/src/index.js");
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    const target = document.querySelector("#boundary")?.firstChild;
    const descriptor = Object.getOwnPropertyDescriptor(CharacterData.prototype, "data");
    if (!(target instanceof Text) || descriptor?.get === undefined || descriptor.set === undefined) throw new Error("Fixture unavailable");
    const original = target.data;
    const get = descriptor.get;
    const set = descriptor.set;
    let writes = 0;
    Object.defineProperty(target, "data", {
      get() { return get.call(this); },
      set(value) {
        set.call(this, value);
        if (++writes === 1) controller.endTarget("same-document-navigation");
      },
    });
    await controller.startScenario("long-text");
    return { snapshot: controller.getSnapshot(), text: target.data, original, later: document.querySelector("#later-target")?.textContent };
  });
  expect(result.snapshot).toMatchObject({ phase: "reload-required", result: { findings: [], restore: { status: "unverified" } } });
  expect(result.text).toBe(result.original);
  expect(result.later).toBe("Continue");
});

test("ending an idle Target Page creates no fabricated Run result", async ({ page }) => {
  await page.goto("/smoke/");
  expect(await page.evaluate(async () => {
    const moduleUrl = "/__engine__/index.js";
      const engine = await import(moduleUrl) as typeof import("../../packages/engine/src/index.js");
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    return controller.endTarget("same-document-navigation");
  })).toBeNull();
});

test("Page Exit cleanup is synchronous even when a detachable client throws", async ({ page }) => {
  await page.goto("/same-document-navigation/");
  const result = await page.evaluate(async () => {
    const moduleUrl = "/__engine__/index.js";
    const engine = await import(moduleUrl) as typeof import("../../packages/engine/src/index.js");
    const controller = engine.createRunController({ document, isExtensionOwnedNode: () => false });
    await controller.startScenario("long-text");
    controller.subscribe(() => { throw new Error("Synthetic detached UI failure"); });
    const result = controller.endTarget("page-exit");
    return { result, text: document.querySelector("#boundary")?.textContent, later: document.querySelector("#later-target")?.textContent };
  });
  expect(result).toMatchObject({ text: "Checkout", later: "Continue", result: { terminationReason: "page-exit", restore: { status: "restored" } } });
});
