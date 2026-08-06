// SPDX-License-Identifier: Apache-2.0

import {
  createMutationJournal,
  type MutationJournal,
  type MutationOutcome,
  type RestoreConflictReason,
  type RestoreResult,
} from "./mutation-journal.js";
import { prepareLongTextMutations } from "../scenarios/long-text.js";
import { prepareUnbreakableTextMutations } from "../scenarios/unbreakable-text.js";

export type ScenarioId = "long-text" | "unbreakable-text";

export type RunPhase =
  | "idle"
  | "applying-mutations"
  | "ready-for-inspection"
  | "restoring"
  | "completed"
  | "aborted"
  | "reload-required";

export type RunCoverage = {
  readonly eligibleTargets: number;
  readonly mutatedTargets: number;
  readonly skippedTargets: number;
  readonly ineffectiveTargets: number;
  readonly inconclusiveTargets: number;
};

export type SerializedRestoreConflict = {
  readonly kind: string;
  readonly reason: RestoreConflictReason;
};

export type SerializedRestoreResult = {
  readonly conflicts: readonly SerializedRestoreConflict[];
  readonly status: RestoreResult["status"];
};

type SerializedRunResultBase = {
  readonly scenarioId: ScenarioId;
  readonly coverage: RunCoverage;
  readonly findings: readonly never[];
  readonly restore: SerializedRestoreResult;
  readonly summary: string;
};

export type SerializedRunResult =
  | (SerializedRunResultBase & {
      readonly status: "completed";
    })
  | (SerializedRunResultBase & {
      readonly status: "aborted";
      readonly terminationReason: "unknown-mutation-state";
    });

export type RunSnapshot = {
  readonly phase: RunPhase;
  readonly scenarioId: ScenarioId | null;
  readonly coverage: RunCoverage;
  readonly result: SerializedRunResult | null;
};

export type RunController = {
  getSnapshot(): RunSnapshot;
  restore(): void;
  startScenario(scenarioId: ScenarioId): Promise<void>;
  subscribe(listener: () => void): () => void;
};

export type RunControllerOptions = {
  readonly document: Document;
  readonly isExtensionOwnedNode: (node: Node) => boolean;
};

const zeroCoverage = (): RunCoverage =>
  Object.freeze({
    eligibleTargets: 0,
    mutatedTargets: 0,
    skippedTargets: 0,
    ineffectiveTargets: 0,
    inconclusiveTargets: 0,
  });

const freezeCoverage = (coverage: RunCoverage): RunCoverage =>
  Object.freeze({ ...coverage });

const serializeRestore = (restore: RestoreResult): SerializedRestoreResult =>
  Object.freeze({
    status: restore.status,
    conflicts: Object.freeze(
      restore.conflicts.map(({ kind, reason }) =>
        Object.freeze({ kind, reason }),
      ),
    ),
  });

const summaryForRestore = (restore: RestoreResult): string => {
  if (restore.status === "restored") {
    return "No supported Finding was produced. This does not claim the Target Page has no layout problems.";
  }
  if (restore.status === "conflict") {
    return "Restore conflicts were left untouched to avoid overwriting external changes. Reload required.";
  }
  return "Restore could not be verified completely. Reload required.";
};

const prepareScenarioMutations = (
  scenarioId: ScenarioId,
  options: RunControllerOptions,
) => {
  switch (scenarioId) {
    case "long-text":
      return prepareLongTextMutations(options);
    case "unbreakable-text":
      return prepareUnbreakableTextMutations(options);
  }
};

export function createRunController(
  options: RunControllerOptions,
): RunController {
  const listeners = new Set<() => void>();
  let journal: MutationJournal | null = null;
  let snapshot: RunSnapshot = Object.freeze({
    phase: "idle",
    scenarioId: null,
    coverage: zeroCoverage(),
    result: null,
  });

  const publish = (next: RunSnapshot): void => {
    snapshot = Object.freeze(next);
    for (const listener of listeners) {
      listener();
    }
  };

  const completedResult = (
    scenarioId: ScenarioId,
    coverage: RunCoverage,
    restore: RestoreResult,
  ): SerializedRunResult =>
    Object.freeze({
      scenarioId,
      status: "completed",
      coverage,
      findings: Object.freeze([]),
      restore: serializeRestore(restore),
      summary: summaryForRestore(restore),
    });

  const abortedResult = (
    scenarioId: ScenarioId,
    coverage: RunCoverage,
    restore: RestoreResult,
  ): SerializedRunResult =>
    Object.freeze({
      scenarioId,
      status: "aborted",
      terminationReason: "unknown-mutation-state",
      coverage,
      findings: Object.freeze([]),
      restore: serializeRestore(restore),
      summary:
        restore.status === "restored"
          ? "The Run was aborted after an unverified Mutation. Applied values were restored; no Findings were produced."
          : "The Run was aborted after an unverified Mutation and cleanup was incomplete. Reload required; no Findings were produced.",
    });

  const controller: RunController = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    startScenario: async (scenarioId) => {
      if (snapshot.phase === "reload-required") {
        throw new Error("The Document requires reload before another Run");
      }
      if (
        snapshot.phase !== "idle" &&
        snapshot.phase !== "completed" &&
        snapshot.phase !== "aborted"
      ) {
        throw new Error("A Run is already active");
      }

      publish({
        phase: "applying-mutations",
        scenarioId,
        coverage: zeroCoverage(),
        result: null,
      });

      const records = prepareScenarioMutations(scenarioId, options);
      const activeJournal = createMutationJournal(options.document);
      journal = activeJournal;
      let mutatedTargets = 0;
      let skippedTargets = 0;
      let ineffectiveTargets = 0;
      let inconclusiveTargets = 0;

      const recordOutcome = (outcome: MutationOutcome): void => {
        switch (outcome) {
          case "applied":
            mutatedTargets += 1;
            break;
          case "applied-ineffective":
            mutatedTargets += 1;
            ineffectiveTargets += 1;
            inconclusiveTargets += 1;
            break;
          case "safe-failure":
            inconclusiveTargets += 1;
            break;
          case "skipped":
            skippedTargets += 1;
            break;
          case "unknown":
            inconclusiveTargets += 1;
            break;
        }
      };

      for (const record of records) {
        const outcome = activeJournal.apply(record);
        recordOutcome(outcome);
        if (outcome === "unknown") {
          const coverage = freezeCoverage({
            eligibleTargets: records.length,
            mutatedTargets,
            skippedTargets,
            ineffectiveTargets,
            inconclusiveTargets,
          });
          const restore = activeJournal.restore();
          journal = null;
          publish({
            phase:
              restore.status === "restored" ? "aborted" : "reload-required",
            scenarioId,
            coverage,
            result: abortedResult(scenarioId, coverage, restore),
          });
          return;
        }
      }

      publish({
        phase: "ready-for-inspection",
        scenarioId,
        coverage: freezeCoverage({
          eligibleTargets: records.length,
          mutatedTargets,
          skippedTargets,
          ineffectiveTargets,
          inconclusiveTargets,
        }),
        result: null,
      });
    },
    restore: () => {
      if (snapshot.phase !== "ready-for-inspection" || journal === null) {
        throw new Error("No active Run is ready to Restore");
      }
      const scenarioId = snapshot.scenarioId;
      if (scenarioId === null) {
        throw new Error("Active Run has no Scenario");
      }
      publish({ ...snapshot, phase: "restoring" });

      const restore = journal.restore();
      journal = null;
      const result = completedResult(scenarioId, snapshot.coverage, restore);
      publish({
        phase: restore.status === "restored" ? "completed" : "reload-required",
        scenarioId,
        coverage: snapshot.coverage,
        result,
      });
    },
  };

  return controller;
}
