// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";

test("Engine public seam runs Long Text independently of extension adapters", async ({
  page,
}) => {
  await page.goto("/long-text-run/");

  const observation = await page.evaluate(async () => {
    type Snapshot = {
      readonly coverage: {
        readonly eligibleTargets: number;
        readonly inconclusiveTargets: number;
        readonly ineffectiveTargets: number;
        readonly mutatedTargets: number;
        readonly skippedTargets: number;
      };
      readonly phase: string;
      readonly result: null | {
        readonly findings: readonly unknown[];
        readonly summary: string;
      };
    };
    type Controller = {
      getSnapshot(): Snapshot;
      restore(): void;
      startScenario(scenarioId: "long-text"): Promise<void>;
      subscribe(listener: () => void): () => void;
    };
    type EngineModule = {
      createRunController(options: {
        readonly document: Document;
        readonly isExtensionOwnedNode: (node: Node) => boolean;
      }): Controller;
    };

    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as EngineModule;
    const controller = engine.createRunController({
      document,
      isExtensionOwnedNode: () => false,
    });
    const target = document.querySelector("#primary-target")?.firstChild;
    if (!(target instanceof Text)) {
      throw new Error("Fixture target was unavailable");
    }
    const original = target.data;
    const notifications: string[] = [];
    const unsubscribe = controller.subscribe(() => {
      notifications.push(controller.getSnapshot().phase);
    });

    await controller.startScenario("long-text");
    const active = controller.getSnapshot();
    const activeValue = target.data;
    let secondRunError = "";
    try {
      await controller.startScenario("long-text");
    } catch (error) {
      secondRunError = error instanceof Error ? error.message : "unknown";
    }
    controller.restore();
    const completed = controller.getSnapshot();
    unsubscribe();

    return {
      active,
      activeFrozen: Object.isFrozen(active) && Object.isFrozen(active.coverage),
      activeValue,
      completed,
      completedFrozen:
        Object.isFrozen(completed) &&
        Object.isFrozen(completed.coverage) &&
        Object.isFrozen(completed.result),
      notifications,
      original,
      restored: target.data,
      secondRunError,
    };
  });

  expect(observation.active).toMatchObject({
    phase: "ready-for-inspection",
    coverage: {
      eligibleTargets: 7,
      inconclusiveTargets: 1,
      ineffectiveTargets: 0,
      mutatedTargets: 7,
      skippedTargets: 0,
    },
    result: null,
  });
  expect(observation.activeFrozen).toBe(true);
  expect(observation.activeValue).toBe(
    "  Checkout now! Checkout now! Checkout now!  ",
  );
  expect(observation.secondRunError).toBe("A Run is already active");
  expect(observation.restored).toBe(observation.original);
  expect(observation.completed).toMatchObject({
    phase: "completed",
    result: {
      findings: [],
      summary: expect.stringContaining("does not claim"),
    },
  });
  expect(observation.completedFrozen).toBe(true);
  expect(observation.notifications).toEqual([
    "applying-mutations",
    "ready-for-inspection",
    "restoring",
    "completed",
  ]);
});

test("immediate write verification stops later mutations without overwriting non-owned state", async ({
  page,
}) => {
  await page.goto("/long-text-run/");

  const observation = await page.evaluate(async () => {
    type Controller = {
      getSnapshot(): {
        readonly coverage: Record<string, number>;
        readonly phase: string;
      };
      startScenario(scenarioId: "long-text"): Promise<void>;
    };
    type EngineModule = {
      createRunController(options: {
        readonly document: Document;
        readonly isExtensionOwnedNode: (node: Node) => boolean;
      }): Controller;
    };
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as EngineModule;
    const controller = engine.createRunController({
      document,
      isExtensionOwnedNode: () => false,
    });
    const target = document.querySelector("#primary-target")?.firstChild;
    const laterTarget = document.querySelector("#inline-target")?.firstChild;
    const dataDescriptor = Object.getOwnPropertyDescriptor(
      CharacterData.prototype,
      "data",
    );
    if (
      !(target instanceof Text) ||
      !(laterTarget instanceof Text) ||
      dataDescriptor?.get === undefined ||
      dataDescriptor.set === undefined
    ) {
      throw new Error("Mutation-safety fixture was unavailable");
    }
    const laterOriginal = laterTarget.data;
    const nativeGet = dataDescriptor.get;
    const nativeSet = dataDescriptor.set;
    Object.defineProperty(target, "data", {
      configurable: true,
      get() {
        return nativeGet.call(this) as string;
      },
      set() {
        nativeSet.call(this, "Externally changed");
        throw new Error("Synthetic write failure after a state change");
      },
    });

    await controller.startScenario("long-text");
    return {
      laterOriginal,
      laterValue: laterTarget.data,
      snapshot: controller.getSnapshot(),
      nonOwnedValue: target.data,
    };
  });

  expect(observation.snapshot).toMatchObject({
    phase: "reload-required",
    coverage: {
      eligibleTargets: 7,
      inconclusiveTargets: 1,
      mutatedTargets: 0,
    },
  });
  expect(observation.nonOwnedValue).toBe("Externally changed");
  expect(observation.laterValue).toBe(observation.laterOriginal);
});
