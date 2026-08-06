// SPDX-License-Identifier: Apache-2.0

import {
  prepareLongTextMutations,
  type LongTextMutation,
} from "../scenarios/long-text.js";

export type ScenarioId = "long-text";

export type RunPhase =
  | "idle"
  | "applying-mutations"
  | "ready-for-inspection"
  | "restoring"
  | "completed"
  | "reload-required";

export type RunCoverage = {
  readonly eligibleTargets: number;
  readonly mutatedTargets: number;
  readonly skippedTargets: number;
  readonly ineffectiveTargets: number;
  readonly inconclusiveTargets: number;
};

export type SerializedRunResult = {
  readonly scenarioId: ScenarioId;
  readonly status: "completed";
  readonly coverage: RunCoverage;
  readonly findings: readonly never[];
  readonly restoreStatus: "restored";
  readonly summary: string;
};

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

export function createRunController(
  options: RunControllerOptions,
): RunController {
  const listeners = new Set<() => void>();
  let journal: LongTextMutation[] = [];
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

  const controller: RunController = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    startScenario: async (scenarioId) => {
      if (
        snapshot.phase !== "idle" &&
        snapshot.phase !== "completed"
      ) {
        throw new Error("A Run is already active");
      }

      publish({
        phase: "applying-mutations",
        scenarioId,
        coverage: zeroCoverage(),
        result: null,
      });

      journal = prepareLongTextMutations(options);
      const eligibleTargets = journal.length;
      let mutatedTargets = 0;
      let skippedTargets = 0;
      let inconclusiveTargets = 0;
      const appliedJournal: LongTextMutation[] = [];

      const stopAfterUnverifiedWrite = (
        uncertainRecord: LongTextMutation,
      ): void => {
        journal = [...appliedJournal, uncertainRecord];
        for (const appliedRecord of [...journal].reverse()) {
          if (
            appliedRecord.target.isConnected &&
            appliedRecord.target.ownerDocument === options.document &&
            appliedRecord.target.data === appliedRecord.appliedValue
          ) {
            try {
              appliedRecord.target.data = appliedRecord.originalValue;
            } catch {
              // The terminal state remains reload-required. Never overwrite a
              // value whose ownership cannot be verified.
            }
          }
        }
        publish({
          phase: "reload-required",
          scenarioId,
          coverage: freezeCoverage({
            eligibleTargets,
            mutatedTargets,
            skippedTargets,
            ineffectiveTargets: 0,
            inconclusiveTargets: inconclusiveTargets + 1,
          }),
          result: null,
        });
      };

      for (const record of journal) {
        if (
          !record.target.isConnected ||
          record.target.ownerDocument !== options.document ||
          record.target.data !== record.originalValue
        ) {
          skippedTargets += 1;
          continue;
        }

        try {
          record.target.data = record.appliedValue;
        } catch {
          if (record.target.data !== record.originalValue) {
            stopAfterUnverifiedWrite(record);
            return;
          }
          inconclusiveTargets += 1;
          continue;
        }

        if (record.target.data !== record.appliedValue) {
          if (record.target.data !== record.originalValue) {
            stopAfterUnverifiedWrite(record);
            return;
          }
          inconclusiveTargets += 1;
          continue;
        }
        appliedJournal.push(record);
        mutatedTargets += 1;
      }
      journal = appliedJournal;
      publish({
        phase: "ready-for-inspection",
        scenarioId,
        coverage: freezeCoverage({
          eligibleTargets,
          mutatedTargets,
          skippedTargets,
          ineffectiveTargets: 0,
          inconclusiveTargets,
        }),
        result: null,
      });
    },
    restore: () => {
      if (snapshot.phase !== "ready-for-inspection") {
        throw new Error("No active Run is ready to Restore");
      }
      const scenarioId = snapshot.scenarioId;
      if (scenarioId === null) {
        throw new Error("Active Run has no Scenario");
      }
      publish({ ...snapshot, phase: "restoring" });

      let restoreIncomplete = false;
      for (const record of [...journal].reverse()) {
        if (
          !record.target.isConnected ||
          record.target.ownerDocument !== options.document ||
          record.target.data !== record.appliedValue
        ) {
          restoreIncomplete = true;
          continue;
        }
        try {
          record.target.data = record.originalValue;
        } catch {
          restoreIncomplete = true;
          continue;
        }
        if (record.target.data !== record.originalValue) {
          restoreIncomplete = true;
        }
      }

      if (restoreIncomplete) {
        publish({ ...snapshot, phase: "reload-required" });
        return;
      }

      const result: SerializedRunResult = Object.freeze({
        scenarioId,
        status: "completed",
        coverage: snapshot.coverage,
        findings: Object.freeze([]),
        restoreStatus: "restored",
        summary:
          "No supported Finding was produced. This does not claim the Target Page has no layout problems.",
      });
      journal = [];
      publish({
        phase: "completed",
        scenarioId,
        coverage: snapshot.coverage,
        result,
      });
    },
  };

  return controller;
}
