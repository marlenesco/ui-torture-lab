// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";

type MutationState = string | { readonly priority: string; readonly value: string };

type MutationRecord = {
  readonly appliedState: MutationState;
  readonly isEffective?: () => boolean;
  readonly kind: string;
  readonly originalState: MutationState;
  readonly readState: () => MutationState;
  readonly statesEqual: (a: MutationState, b: MutationState) => boolean;
  readonly target: Node;
  readonly writeState: (state: MutationState) => void;
};

type MutationJournal = {
  readonly size: number;
  apply(record: MutationRecord): string;
  restore(): {
    readonly conflicts: ReadonlyArray<{ readonly reason: string }>;
    readonly restoredTargets: number;
    readonly status: string;
  };
};

type JournalModule = {
  createMutationJournal(document: Document): MutationJournal;
  createStyleMutationRecord(options: {
    readonly appliedPriority: string;
    readonly appliedValue: string;
    readonly property: string;
    readonly target: HTMLElement;
  }): MutationRecord;
  createTextMutationRecord(options: {
    readonly appliedValue: string;
    readonly target: Text;
  }): MutationRecord;
};

const journalModuleUrl = "/__engine__/run/mutation-journal.js";

test("Mutation Journal classifies local outcomes and stops after unknown state", async ({
  page,
}) => {
  await page.goto("/long-text-run/");

  const observation = await page.evaluate(async (moduleUrl) => {
    const journalModule = (await import(moduleUrl)) as JournalModule;
    const journal = journalModule.createMutationJournal(document);
    const sourceTarget = document.createTextNode("source");
    document.body.append(sourceTarget);
    const skipped = journalModule.createTextMutationRecord({
      target: sourceTarget,
      appliedValue: "applied",
    });
    sourceTarget.data = "changed before apply";

    const safeState = "original";
    const safeFailure: MutationRecord = {
      kind: "safe-failure",
      target: document.body,
      originalState: "original",
      appliedState: "applied",
      readState: () => safeState,
      writeState: () => undefined,
      statesEqual: Object.is,
    };

    let ineffectiveState = "original";
    const ineffective: MutationRecord = {
      kind: "ineffective",
      target: document.body,
      originalState: "original",
      appliedState: "applied",
      readState: () => ineffectiveState,
      writeState: (state) => {
        ineffectiveState = state as string;
      },
      statesEqual: Object.is,
      isEffective: () => false,
    };

    let unknownState = "original";
    let journaledBeforeWrite = false;
    const unknown: MutationRecord = {
      kind: "unknown",
      target: document.body,
      originalState: "original",
      appliedState: "applied",
      readState: () => unknownState,
      writeState: () => {
        journaledBeforeWrite = journal.size === 4;
        unknownState = "unrecorded value";
      },
      statesEqual: Object.is,
    };

    const outcomes = [
      journal.apply(skipped),
      journal.apply(safeFailure),
      journal.apply(ineffective),
      journal.apply(unknown),
    ];
    let laterApplyError = "";
    try {
      journal.apply(
        journalModule.createTextMutationRecord({
          target: sourceTarget,
          appliedValue: "must not apply",
        }),
      );
    } catch (error) {
      laterApplyError = error instanceof Error ? error.message : "unknown";
    }

    return {
      ineffectiveState,
      journaledBeforeWrite,
      laterApplyError,
      outcomes,
      safeState,
      unknownState,
    };
  }, journalModuleUrl);

  expect(observation).toEqual({
    ineffectiveState: "applied",
    journaledBeforeWrite: true,
    laterApplyError: "Mutation Journal is not writable after unknown state",
    outcomes: ["skipped", "safe-failure", "applied-ineffective", "unknown"],
    safeState: "original",
    unknownState: "unrecorded value",
  });
});

test("comparator exceptions are contained before write, after write, and during Restore", async ({
  page,
}) => {
  await page.goto("/long-text-run/");

  const observation = await page.evaluate(async (moduleUrl) => {
    const journalModule = (await import(moduleUrl)) as JournalModule;

    const beforeJournal = journalModule.createMutationJournal(document);
    let beforeWrites = 0;
    const beforeOutcome = beforeJournal.apply({
      kind: "compare-before",
      target: document.body,
      originalState: "original",
      appliedState: "applied",
      readState: () => "original",
      writeState: () => {
        beforeWrites += 1;
      },
      statesEqual: () => {
        throw new Error("compare before write");
      },
    });

    const afterJournal = journalModule.createMutationJournal(document);
    let afterState = "original";
    let afterComparisons = 0;
    const afterOutcome = afterJournal.apply({
      kind: "compare-after",
      target: document.body,
      originalState: "original",
      appliedState: "applied",
      readState: () => afterState,
      writeState: (state) => {
        afterState = state as string;
      },
      statesEqual: (a, b) => {
        afterComparisons += 1;
        if (afterComparisons === 2) {
          throw new Error("compare after write");
        }
        return a === b;
      },
    });

    const restoreJournal = journalModule.createMutationJournal(document);
    let olderState = "older-original";
    const older = {
      kind: "older",
      target: document.body,
      originalState: "older-original",
      appliedState: "older-applied",
      readState: () => olderState,
      writeState: (state: MutationState) => {
        olderState = state as string;
      },
      statesEqual: Object.is,
    } satisfies MutationRecord;
    let restoreState = "restore-original";
    let restoreComparisons = 0;
    const compareDuringRestore = {
      kind: "compare-restore",
      target: document.body,
      originalState: "restore-original",
      appliedState: "restore-applied",
      readState: () => restoreState,
      writeState: (state: MutationState) => {
        restoreState = state as string;
      },
      statesEqual: (a: MutationState, b: MutationState) => {
        restoreComparisons += 1;
        if (restoreComparisons === 4) {
          throw new Error("compare during Restore");
        }
        return a === b;
      },
    } satisfies MutationRecord;
    restoreJournal.apply(older);
    restoreJournal.apply(compareDuringRestore);
    const restore = restoreJournal.restore();

    return {
      afterOutcome,
      afterState,
      beforeOutcome,
      beforeWrites,
      olderState,
      restoreConflicts: restore.conflicts.map(({ reason }) => reason),
      restoreState,
      restoreStatus: restore.status,
    };
  }, journalModuleUrl);

  expect(observation).toEqual({
    afterOutcome: "unknown",
    afterState: "applied",
    beforeOutcome: "safe-failure",
    beforeWrites: 0,
    olderState: "older-original",
    restoreConflicts: ["restore-unverified"],
    restoreState: "restore-applied",
    restoreStatus: "unverified",
  });
});

test("Restore uses reverse identity-safe best effort across conflicts", async ({
  page,
}) => {
  await page.goto("/long-text-run/");

  const observation = await page.evaluate(async (moduleUrl) => {
    const journalModule = (await import(moduleUrl)) as JournalModule;
    const journal = journalModule.createMutationJournal(document);
    const restoreOrder: string[] = [];

    const moved = document.createTextNode("moved-original");
    const movedDocument = document.createTextNode("moved-document-original");
    const changed = document.createTextNode("changed-original");
    const disconnected = document.createTextNode("disconnected-original");
    const replaced = document.createTextNode("replaced-original");
    const restoreThrows = document.createTextNode("throws-original");
    const safeAfterConflict = document.createTextNode("safe-original");
    const firstParent = document.createElement("div");
    const secondParent = document.createElement("div");
    firstParent.append(
      moved,
      movedDocument,
      changed,
      disconnected,
      replaced,
      restoreThrows,
      safeAfterConflict,
    );
    document.body.append(firstParent, secondParent);

    const trackedText = (
      target: Text,
      name: string,
      options: { readonly throwOnRestore?: boolean } = {},
    ): MutationRecord => {
      const originalState = target.data;
      return {
        kind: "text",
        target,
        originalState,
        appliedState: `${name}-applied`,
        readState: () => target.data,
        writeState: (state) => {
          if (state === originalState) {
            restoreOrder.push(name);
            if (options.throwOnRestore === true) {
              throw new Error("synthetic restore failure");
            }
          }
          target.data = state as string;
        },
        statesEqual: Object.is,
      };
    };

    const styleTarget = document.createElement("p");
    document.body.append(styleTarget);
    styleTarget.style.setProperty("font-size", "16px", "");
    const priorityRecord = journalModule.createStyleMutationRecord({
      target: styleTarget,
      property: "font-size",
      appliedValue: "32px",
      appliedPriority: "important",
    });

    const records = [
      trackedText(moved, "moved"),
      trackedText(movedDocument, "moved-document"),
      trackedText(changed, "changed"),
      trackedText(disconnected, "disconnected"),
      trackedText(replaced, "replaced"),
      priorityRecord,
      trackedText(restoreThrows, "throws", { throwOnRestore: true }),
      trackedText(safeAfterConflict, "safe"),
    ];
    const outcomes = records.map((record) => journal.apply(record));

    secondParent.append(moved);
    const frameDocument = document.querySelector<HTMLIFrameElement>(
      "#frame-target",
    )?.contentDocument;
    if (frameDocument === undefined || frameDocument === null) {
      throw new Error("Frame Document was unavailable");
    }
    frameDocument.body.append(frameDocument.adoptNode(movedDocument));
    changed.data = "developer change";
    disconnected.remove();
    const replacement = document.createTextNode("replacement value");
    replaced.replaceWith(replacement);
    styleTarget.style.setProperty("font-size", "32px", "");

    const restore = journal.restore();
    return {
      changed: changed.data,
      conflictReasons: restore.conflicts.map((conflict) => conflict.reason),
      disconnected: disconnected.data,
      moved: moved.data,
      movedDocument: movedDocument.data,
      outcomes,
      priority: {
        priority: styleTarget.style.getPropertyPriority("font-size"),
        value: styleTarget.style.getPropertyValue("font-size"),
      },
      replacement: replacement.data,
      restoreOrder,
      restoreStatus: restore.status,
      restoredTargets: restore.restoredTargets,
      safeAfterConflict: safeAfterConflict.data,
      throws: restoreThrows.data,
    };
  }, journalModuleUrl);

  expect(observation.outcomes).toEqual(Array(8).fill("applied"));
  expect(observation.restoreStatus).toBe("unverified");
  expect(observation.restoredTargets).toBe(2);
  expect(observation.moved).toBe("moved-original");
  expect(observation.movedDocument).toBe("moved-document-applied");
  expect(observation.safeAfterConflict).toBe("safe-original");
  expect(observation.changed).toBe("developer change");
  expect(observation.disconnected).toBe("disconnected-applied");
  expect(observation.replacement).toBe("replacement value");
  expect(observation.throws).toBe("throws-applied");
  expect(observation.priority).toEqual({ priority: "", value: "32px" });
  expect(observation.restoreOrder).toEqual(["safe", "throws", "moved"]);
  expect(observation.conflictReasons).toEqual([
    "restore-failed",
    "applied-state-changed",
    "target-disconnected",
    "target-disconnected",
    "applied-state-changed",
    "target-moved",
  ]);
});
