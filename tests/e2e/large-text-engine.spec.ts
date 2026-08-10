// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";

type Snapshot = {
  readonly coverage: Record<string, number>;
  readonly phase: string;
  readonly result: null | {
    readonly findings: readonly unknown[];
    readonly scenarioId: string;
    readonly status: string;
  };
  readonly scenarioId: string | null;
};

type Controller = {
  getSnapshot(): Snapshot;
  restore(): void;
  startScenario(scenarioId: "large-text"): Promise<void>;
};

type EngineModule = {
  createRunController(options: {
    readonly document: Document;
    readonly isExtensionOwnedNode: (node: Node) => boolean;
  }): Controller;
};

test("Large Text scales each text owner from its baseline and restores exact inline styles", async ({
  page,
}) => {
  await page.goto("/large-text-run/");

  const observation = await page.evaluate(async () => {
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as EngineModule;
    const extensionOwnedProbe = document.querySelector(
      "#extension-owned-probe",
    )?.firstChild;
    const controller = engine.createRunController({
      document,
      isExtensionOwnedNode: (node) => node === extensionOwnedProbe,
    });
    const element = (selector: string): HTMLElement => {
      const target = document.querySelector(selector);
      if (!(target instanceof HTMLElement)) {
        throw new Error(`Missing fixture element for ${selector}`);
      }
      return target;
    };
    const primary = element("#primary-target");
    const nestedParent = element("#nested-parent");
    const nested = element("#nested-target");
    const inline = element("#inline-target");
    const fixedContainer = element("#fixed-container");
    const excluded = [
      element("#vertical-target"),
      element("#hidden-target"),
      element("#code-target"),
      element("#icon-font-target"),
      element("#private-use-icon-target"),
      element("#extension-owned-probe"),
    ];
    const svgText = document.querySelector("#svg-target");
    if (svgText === null) {
      throw new Error("Missing SVG fixture text");
    }

    const originalStyles = new Map(
      [primary, nestedParent, nested, inline].map((target) => [
        target,
        {
          priority: target.style.getPropertyPriority("font-size"),
          value: target.style.getPropertyValue("font-size"),
        },
      ] as const),
    );
    const excludedText = [...excluded, svgText].map((target) => target.textContent);
    const fixedContainerStyle = {
      height: fixedContainer.style.getPropertyValue("height"),
      width: fixedContainer.style.getPropertyValue("width"),
    };
    const primaryHeightBefore = primary.getBoundingClientRect().height;
    const baselineSizes = {
      inline: getComputedStyle(inline).fontSize,
      nested: getComputedStyle(nested).fontSize,
      nestedParent: getComputedStyle(nestedParent).fontSize,
      primary: getComputedStyle(primary).fontSize,
    };

    await controller.startScenario("large-text");
    const active = controller.getSnapshot();
    const appliedStyles = new Map(
      [primary, nestedParent, nested, inline].map((target) => [
        target,
        {
          computed: getComputedStyle(target).fontSize,
          priority: target.style.getPropertyPriority("font-size"),
          value: target.style.getPropertyValue("font-size"),
        },
      ] as const),
    );
    const primaryHeightAfter = primary.getBoundingClientRect().height;
    const excludedUnchanged = [...excluded, svgText].every(
      (target, index) => target.textContent === excludedText[index],
    );
    const fixedContainerUnchanged =
      fixedContainer.style.getPropertyValue("height") === fixedContainerStyle.height &&
      fixedContainer.style.getPropertyValue("width") === fixedContainerStyle.width;

    controller.restore();
    const completed = controller.getSnapshot();
    const restoredExactly = [...originalStyles].every(([target, original]) =>
      target.style.getPropertyValue("font-size") === original.value &&
      target.style.getPropertyPriority("font-size") === original.priority,
    );

    return {
      active,
      appliedStyles: Object.fromEntries(
        [...appliedStyles].map(([target, style]) => [target.id, style]),
      ),
      baselineSizes,
      completed,
      excludedUnchanged,
      fixedContainerUnchanged,
      primaryHeightAfter,
      primaryHeightBefore,
      restoredExactly,
    };
  });

  expect(observation.active).toMatchObject({
    phase: "ready-for-inspection",
    scenarioId: "large-text",
    coverage: {
      eligibleTargets: 4,
      mutatedTargets: 4,
    },
  });
  expect(observation.baselineSizes).toEqual({
    inline: "15px",
    nested: "18px",
    nestedParent: "18px",
    primary: "20px",
  });
  expect(observation.appliedStyles).toEqual({
    "inline-target": { computed: "30px", priority: "important", value: "30px" },
    "nested-parent": { computed: "36px", priority: "important", value: "36px" },
    "nested-target": { computed: "36px", priority: "important", value: "36px" },
    "primary-target": { computed: "40px", priority: "important", value: "40px" },
  });
  expect(observation.primaryHeightAfter).toBeGreaterThan(
    observation.primaryHeightBefore,
  );
  expect(observation.excludedUnchanged).toBe(true);
  expect(observation.fixedContainerUnchanged).toBe(true);
  expect(observation.restoredExactly).toBe(true);
  expect(observation.completed).toMatchObject({
    phase: "completed",
    scenarioId: "large-text",
    result: {
      findings: [
        expect.objectContaining({
          detectorId: "text-clipping",
          locator: "div#fixed-container",
          scenarioId: "large-text",
        }),
      ],
      scenarioId: "large-text",
      status: "completed",
    },
  });
});

test("Large Text leaves an external font-size change untouched during Restore", async ({
  page,
}) => {
  await page.goto("/large-text-run/");

  const observation = await page.evaluate(async () => {
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as EngineModule;
    const controller = engine.createRunController({
      document,
      isExtensionOwnedNode: () => false,
    });
    const primary = document.querySelector("#primary-target");
    if (!(primary instanceof HTMLElement)) {
      throw new Error("Missing primary fixture element");
    }

    await controller.startScenario("large-text");
    primary.style.setProperty("font-size", "77px", "important");
    controller.restore();
    return {
      fontSize: primary.style.getPropertyValue("font-size"),
      priority: primary.style.getPropertyPriority("font-size"),
      snapshot: controller.getSnapshot(),
    };
  });

  expect(observation.fontSize).toBe("77px");
  expect(observation.priority).toBe("important");
  expect(observation.snapshot).toMatchObject({
    phase: "reload-required",
    result: {
      restore: {
        conflicts: [
          { kind: "style:font-size", reason: "applied-state-changed" },
        ],
        status: "conflict",
      },
    },
  });
});

test("Large Text reports an unverifiable computed application as inconclusive", async ({
  page,
}) => {
  await page.goto("/large-text-run/");

  const observation = await page.evaluate(async () => {
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as EngineModule;
    const primary = document.querySelector("#primary-target");
    if (!(primary instanceof HTMLElement)) {
      throw new Error("Missing primary fixture element");
    }
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = ((target: Element) => {
      if (target === primary) {
        if (primary.style.getPropertyValue("font-size") === "40px") {
          throw new Error("Synthetic computed-style verification failure");
        }
      }
      return nativeGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    const controller = engine.createRunController({
      document,
      isExtensionOwnedNode: (node) =>
        node !== primary.firstChild && node.nodeType === Node.TEXT_NODE,
    });
    await controller.startScenario("large-text");
    const active = controller.getSnapshot();
    controller.restore();
    return { active, completed: controller.getSnapshot() };
  });

  expect(observation.active).toMatchObject({
    phase: "ready-for-inspection",
    coverage: {
      eligibleTargets: 1,
      inconclusiveTargets: 1,
      ineffectiveTargets: 1,
      mutatedTargets: 1,
    },
  });
  expect(observation.completed.phase).toBe("completed");
});

test("Large Text applies and restores through a strict page style CSP", async ({
  page,
}) => {
  await page.goto("/large-text-csp/");

  const observation = await page.evaluate(async () => {
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as EngineModule;
    const target = document.querySelector("#primary-target");
    if (!(target instanceof HTMLElement)) {
      throw new Error("Missing CSP fixture element");
    }
    const controller = engine.createRunController({
      document,
      isExtensionOwnedNode: () => false,
    });

    await controller.startScenario("large-text");
    const active = controller.getSnapshot();
    const appliedInlineStyle = {
      priority: target.style.getPropertyPriority("font-size"),
      value: target.style.getPropertyValue("font-size"),
    };
    const computedFontSize = getComputedStyle(target).fontSize;
    controller.restore();
    return {
      active,
      appliedInlineStyle,
      computedFontSize,
      completed: controller.getSnapshot(),
      restoredInlineStyle: {
        priority: target.style.getPropertyPriority("font-size"),
        value: target.style.getPropertyValue("font-size"),
      },
    };
  });

  expect(observation.active).toMatchObject({
    phase: "ready-for-inspection",
    coverage: {
      eligibleTargets: 1,
      inconclusiveTargets: 0,
      ineffectiveTargets: 0,
      mutatedTargets: 1,
    },
  });
  expect(observation.appliedInlineStyle).toEqual({
    priority: "important",
    value: "32px",
  });
  expect(observation.computedFontSize).toBe("32px");
  expect(observation.restoredInlineStyle).toEqual({ priority: "", value: "" });
  expect(observation.completed.phase).toBe("completed");
});

test("Large Text does not rematch a page rerendered target during Restore", async ({
  page,
}) => {
  await page.goto("/large-text-run/");

  const observation = await page.evaluate(async () => {
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as EngineModule;
    const controller = engine.createRunController({
      document,
      isExtensionOwnedNode: () => false,
    });
    const target = document.querySelector("#primary-target");
    if (!(target instanceof HTMLElement)) {
      throw new Error("Missing rerender fixture element");
    }

    await controller.startScenario("large-text");
    const replacement = target.cloneNode(true);
    if (!(replacement instanceof HTMLElement)) {
      throw new Error("Replacement target was unavailable");
    }
    replacement.style.setProperty("font-size", "77px", "important");
    target.replaceWith(replacement);
    controller.restore();
    return {
      replacementStyle: {
        priority: replacement.style.getPropertyPriority("font-size"),
        value: replacement.style.getPropertyValue("font-size"),
      },
      snapshot: controller.getSnapshot(),
    };
  });

  expect(observation.replacementStyle).toEqual({
    priority: "important",
    value: "77px",
  });
  expect(observation.snapshot).toMatchObject({
    phase: "reload-required",
    result: {
      restore: {
        conflicts: [
          { kind: "style:font-size", reason: "target-disconnected" },
        ],
        status: "conflict",
      },
    },
  });
});

test("Large Text skips a baseline font size that changes across an animation frame", async ({
  page,
}) => {
  await page.goto("/large-text-run/");

  const observation = await page.evaluate(async () => {
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as EngineModule;
    const target = document.querySelector("#primary-target");
    if (!(target instanceof HTMLElement)) {
      throw new Error("Missing unstable baseline fixture element");
    }
    const controller = engine.createRunController({
      document,
      isExtensionOwnedNode: (node) =>
        node !== target.firstChild && node.nodeType === Node.TEXT_NODE,
    });
    requestAnimationFrame(() => {
      target.style.setProperty("font-size", "24px", "important");
    });

    await controller.startScenario("large-text");
    const active = controller.getSnapshot();
    controller.restore();
    return {
      active,
      fontSize: target.style.getPropertyValue("font-size"),
      priority: target.style.getPropertyPriority("font-size"),
      completed: controller.getSnapshot(),
    };
  });

  expect(observation.active).toMatchObject({
    phase: "ready-for-inspection",
    coverage: {
      eligibleTargets: 0,
      inconclusiveTargets: 0,
      ineffectiveTargets: 0,
      mutatedTargets: 0,
      skippedTargets: 0,
    },
  });
  expect(observation.fontSize).toBe("24px");
  expect(observation.priority).toBe("important");
  expect(observation.completed.phase).toBe("completed");
});
