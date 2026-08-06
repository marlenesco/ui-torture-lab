// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";

const canonicalToken =
  "UTL0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxy";

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
  startScenario(scenarioId: "unbreakable-text"): Promise<void>;
};

type EngineModule = {
  createRunController(options: {
    readonly document: Document;
    readonly isExtensionOwnedNode: (node: Node) => boolean;
  }): Controller;
};

test("Unbreakable Text appends one canonical token without classifying content", async ({
  page,
}) => {
  await page.goto("/unbreakable-text-run/");
  await page.waitForFunction(
    () =>
      document
        .querySelector<HTMLIFrameElement>("#frame-target")
        ?.contentDocument?.querySelector("#frame-text") !== null,
  );

  const observation = await page.evaluate(async (token) => {
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as EngineModule;
    const extensionOwnedProbe = document.querySelector(
      "#extension-owned-probe",
    )?.firstChild;
    const controller = engine.createRunController({
      document,
      isExtensionOwnedNode: (node) => node === extensionOwnedProbe,
    });
    const text = (selector: string): Text => {
      const node = document.querySelector(selector)?.firstChild;
      if (!(node instanceof Text)) {
        throw new Error(`Missing fixture Text for ${selector}`);
      }
      return node;
    };
    const primary = text("#primary-target");
    const url = text("#url-target");
    const email = text("#email-target");
    const single = text("#single-target");
    const inline = document.querySelector("#inline-target");
    const inlineNodes = inline === null ? [] : [...inline.childNodes];
    const excluded = [
      text("#hidden-target"),
      text("#editable-target"),
      text("#code-target"),
      text("#structured-target"),
      text("#whitespace-target"),
      text("#extension-owned-probe"),
    ];
    const shadowText = document
      .querySelector("#shadow-host")
      ?.shadowRoot?.querySelector("#shadow-text")?.firstChild;
    const frameText = document
      .querySelector<HTMLIFrameElement>("#frame-target")
      ?.contentDocument?.querySelector("#frame-text")?.firstChild;
    if (
      shadowText?.nodeType !== Node.TEXT_NODE ||
      frameText?.nodeType !== Node.TEXT_NODE
    ) {
      throw new Error("Nested-scope fixture Text was unavailable");
    }
    const shadowTarget = shadowText as Text;
    const frameTarget = frameText as Text;
    const originalPrimary = primary.data;
    const originalUrl = url.data;
    const originalEmail = email.data;
    const originalInlineHtml = inline?.innerHTML;
    const excludedOriginals = [...excluded, shadowTarget, frameTarget].map(
      (node) => [node, node.data] as const,
    );

    await controller.startScenario("unbreakable-text");
    const active = controller.getSnapshot();
    const activeValues = {
      email: email.data,
      inlineHtml: inline?.innerHTML,
      primary: primary.data,
      single: single.data,
      url: url.data,
    };
    const identityPreserved =
      inline !== null &&
      inlineNodes.length === inline.childNodes.length &&
      inlineNodes.every((node, index) => node === inline.childNodes[index]);
    const excludedUnchanged = excludedOriginals.every(
      ([node, original]) => node.data === original,
    );

    controller.restore();
    const completed = controller.getSnapshot();
    return {
      active,
      activeValues,
      completed,
      excludedUnchanged,
      identityPreserved,
      originalEmail,
      originalInlineHtml,
      originalPrimary,
      originalUrl,
      restored: {
        email: email.data,
        inlineHtml: inline?.innerHTML,
        primary: primary.data,
        url: url.data,
      },
      serializedResult: JSON.stringify(completed.result),
      tokenOccurrences: activeValues.primary.split(token).length - 1,
    };
  }, canonicalToken);

  expect(canonicalToken).toMatch(/^[A-Za-z0-9]+$/u);
  expect(canonicalToken).toHaveLength(64);
  expect(observation.active).toMatchObject({
    phase: "ready-for-inspection",
    scenarioId: "unbreakable-text",
    coverage: {
      eligibleTargets: 7,
      mutatedTargets: 7,
    },
  });
  expect(observation.activeValues.primary).toBe(
    `  Checkout now! ${canonicalToken}  `,
  );
  expect(observation.activeValues.url).toBe(
    `https://example.test/orders/42 ${canonicalToken}`,
  );
  expect(observation.activeValues.email).toBe(
    `developer@example.test ${canonicalToken}`,
  );
  expect(observation.activeValues.single).toBe(`X ${canonicalToken}`);
  expect(observation.activeValues.inlineHtml).toBe(
    `Hello ${canonicalToken} <strong>brave ${canonicalToken}</strong> world ${canonicalToken}`,
  );
  expect(observation.tokenOccurrences).toBe(1);
  expect(observation.identityPreserved).toBe(true);
  expect(observation.excludedUnchanged).toBe(true);
  expect(observation.restored).toEqual({
    email: observation.originalEmail,
    inlineHtml: observation.originalInlineHtml,
    primary: observation.originalPrimary,
    url: observation.originalUrl,
  });
  expect(observation.completed).toMatchObject({
    phase: "completed",
    scenarioId: "unbreakable-text",
    result: {
      findings: [],
      scenarioId: "unbreakable-text",
      status: "completed",
    },
  });
  expect(observation.serializedResult).not.toContain(canonicalToken);
});

test("Unbreakable Text reports an applied-ineffective target through the public Run", async ({
  page,
}) => {
  await page.goto("/unbreakable-text-run/");

  const observation = await page.evaluate(async () => {
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as EngineModule;
    const target = document.querySelector("#primary-target")?.firstChild;
    const descriptor = Object.getOwnPropertyDescriptor(
      CharacterData.prototype,
      "data",
    );
    if (
      !(target instanceof Text) ||
      descriptor?.get === undefined ||
      descriptor.set === undefined
    ) {
      throw new Error("Ineffective fixture was unavailable");
    }
    const nativeGet = descriptor.get;
    const nativeSet = descriptor.set;
    let written = false;
    let readsAfterWrite = 0;
    Object.defineProperty(target, "data", {
      configurable: true,
      get() {
        if (written) {
          readsAfterWrite += 1;
          if (readsAfterWrite === 2) {
            throw new Error("Synthetic effectiveness check failure");
          }
        }
        return nativeGet.call(this) as string;
      },
      set(value: string) {
        nativeSet.call(this, value);
        written = true;
      },
    });
    const controller = engine.createRunController({
      document,
      isExtensionOwnedNode: (node) =>
        node !== target && node.nodeType === Node.TEXT_NODE,
    });
    await controller.startScenario("unbreakable-text");
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

test("Unbreakable Text safety-aborts an unverifiable write before later targets", async ({
  page,
}) => {
  await page.goto("/unbreakable-text-run/");

  const observation = await page.evaluate(async () => {
    const moduleUrl = "/__engine__/index.js";
    const engine = (await import(moduleUrl)) as EngineModule;
    const target = document.querySelector("#primary-target")?.firstChild;
    const laterTarget = document.querySelector("#url-target")?.firstChild;
    const descriptor = Object.getOwnPropertyDescriptor(
      CharacterData.prototype,
      "data",
    );
    if (
      !(target instanceof Text) ||
      !(laterTarget instanceof Text) ||
      descriptor?.get === undefined ||
      descriptor.set === undefined
    ) {
      throw new Error("Unsafe fixture was unavailable");
    }
    const laterOriginal = laterTarget.data;
    const nativeGet = descriptor.get;
    const nativeSet = descriptor.set;
    Object.defineProperty(target, "data", {
      configurable: true,
      get() {
        return nativeGet.call(this) as string;
      },
      set() {
        nativeSet.call(this, "External value");
        throw new Error("Synthetic unverified write");
      },
    });
    const controller = engine.createRunController({
      document,
      isExtensionOwnedNode: () => false,
    });
    await controller.startScenario("unbreakable-text");
    return {
      laterOriginal,
      laterValue: laterTarget.data,
      resultJson: JSON.stringify(controller.getSnapshot().result),
      snapshot: controller.getSnapshot(),
      targetValue: target.data,
    };
  });

  expect(observation.snapshot).toMatchObject({
    phase: "reload-required",
    scenarioId: "unbreakable-text",
    result: { status: "aborted", findings: [] },
  });
  expect(observation.targetValue).toBe("External value");
  expect(observation.laterValue).toBe(observation.laterOriginal);
  expect(observation.resultJson).not.toContain(canonicalToken);
});
