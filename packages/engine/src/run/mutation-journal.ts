// SPDX-License-Identifier: Apache-2.0

export type MutationOutcome =
  | "applied"
  | "applied-ineffective"
  | "safe-failure"
  | "skipped"
  | "unknown";

export type MutationRecord<State = unknown> = {
  readonly appliedState: State;
  readonly isEffective?: () => boolean;
  readonly kind: string;
  readonly originalState: State;
  readonly readState: () => State;
  readonly statesEqual: (a: State, b: State) => boolean;
  readonly target: Node;
  readonly writeState: (state: State) => void;
};

export type RestoreConflictReason =
  | "applied-state-changed"
  | "restore-failed"
  | "restore-unverified"
  | "target-disconnected"
  | "target-moved";

export type RestoreConflict = {
  readonly kind: string;
  readonly reason: RestoreConflictReason;
  readonly target: Node;
};

export type RestoreResult = {
  readonly conflicts: readonly RestoreConflict[];
  readonly restoredTargets: number;
  readonly status: "conflict" | "restored" | "unverified";
};

export type MutationJournal = {
  readonly size: number;
  apply<State>(record: MutationRecord<State>): MutationOutcome;
  restore(): RestoreResult;
};

type JournalEntry = {
  outcome: MutationOutcome | "pending";
  readonly record: MutationRecord<unknown>;
};

const readSafely = (
  record: MutationRecord<unknown>,
): { readonly ok: true; readonly state: unknown } | { readonly ok: false } => {
  try {
    return { ok: true, state: record.readState() };
  } catch {
    return { ok: false };
  }
};

const compareSafely = (
  record: MutationRecord<unknown>,
  a: unknown,
  b: unknown,
): { readonly equal: boolean; readonly ok: true } | { readonly ok: false } => {
  try {
    return { equal: record.statesEqual(a, b), ok: true };
  } catch {
    return { ok: false };
  }
};

const freezeRestoreResult = (
  conflicts: RestoreConflict[],
  restoredTargets: number,
  cleanupUnverified: boolean,
): RestoreResult => {
  return Object.freeze({
    conflicts: Object.freeze(conflicts),
    restoredTargets,
    status: cleanupUnverified
      ? "unverified"
      : conflicts.length > 0
        ? "conflict"
        : "restored",
  });
};

export function createMutationJournal(document: Document): MutationJournal {
  const entries: JournalEntry[] = [];
  let writable = true;

  return {
    get size() {
      return entries.length;
    },
    apply: <State>(typedRecord: MutationRecord<State>): MutationOutcome => {
      if (!writable) {
        throw new Error("Mutation Journal is not writable after unknown state");
      }
      const record = typedRecord as MutationRecord<unknown>;
      const entry: JournalEntry = { outcome: "pending", record };
      entries.push(entry);

      const source = readSafely(record);
      if (
        !record.target.isConnected ||
        record.target.ownerDocument !== document ||
        !source.ok
      ) {
        entry.outcome = "skipped";
        return entry.outcome;
      }
      const sourceMatches = compareSafely(
        record,
        source.state,
        record.originalState,
      );
      if (!sourceMatches.ok) {
        entry.outcome = "safe-failure";
        return entry.outcome;
      }
      if (!sourceMatches.equal) {
        entry.outcome = "skipped";
        return entry.outcome;
      }

      let writeThrew = false;
      try {
        record.writeState(record.appliedState);
      } catch {
        writeThrew = true;
      }
      const written = readSafely(record);
      if (!written.ok) {
        writable = false;
        entry.outcome = "unknown";
        return entry.outcome;
      }
      const stillOriginal = compareSafely(
        record,
        written.state,
        record.originalState,
      );
      if (!stillOriginal.ok) {
        writable = false;
        entry.outcome = "unknown";
        return entry.outcome;
      }
      if (writeThrew) {
        if (stillOriginal.equal) {
          entry.outcome = "safe-failure";
          return entry.outcome;
        }
        writable = false;
        entry.outcome = "unknown";
        return entry.outcome;
      }
      if (stillOriginal.equal) {
        entry.outcome = "safe-failure";
        return entry.outcome;
      }
      const matchesApplied = compareSafely(
        record,
        written.state,
        record.appliedState,
      );
      if (!matchesApplied.ok || !matchesApplied.equal) {
        writable = false;
        entry.outcome = "unknown";
        return entry.outcome;
      }

      try {
        entry.outcome =
          record.isEffective?.() === false
            ? "applied-ineffective"
            : "applied";
      } catch {
        entry.outcome = "applied-ineffective";
      }
      return entry.outcome;
    },
    restore: (): RestoreResult => {
      writable = false;
      const conflicts: RestoreConflict[] = [];
      let restoredTargets = 0;
      let cleanupUnverified = false;

      for (const { outcome, record } of [...entries].reverse()) {
        if (
          outcome !== "applied" &&
          outcome !== "applied-ineffective" &&
          outcome !== "unknown"
        ) {
          continue;
        }
        if (!record.target.isConnected) {
          cleanupUnverified ||= outcome === "unknown";
          conflicts.push({
            kind: record.kind,
            reason: "target-disconnected",
            target: record.target,
          });
          continue;
        }
        if (record.target.ownerDocument !== document) {
          cleanupUnverified ||= outcome === "unknown";
          conflicts.push({
            kind: record.kind,
            reason: "target-moved",
            target: record.target,
          });
          continue;
        }
        const current = readSafely(record);
        if (!current.ok) {
          cleanupUnverified = true;
          conflicts.push({
            kind: record.kind,
            reason: "restore-unverified",
            target: record.target,
          });
          continue;
        }
        const stillOwned = compareSafely(
          record,
          current.state,
          record.appliedState,
        );
        if (!stillOwned.ok) {
          cleanupUnverified = true;
          conflicts.push({
            kind: record.kind,
            reason: "restore-unverified",
            target: record.target,
          });
          continue;
        }
        if (!stillOwned.equal) {
          cleanupUnverified ||= outcome === "unknown";
          conflicts.push({
            kind: record.kind,
            reason: "applied-state-changed",
            target: record.target,
          });
          continue;
        }
        try {
          record.writeState(record.originalState);
        } catch {
          cleanupUnverified = true;
          conflicts.push({
            kind: record.kind,
            reason: "restore-failed",
            target: record.target,
          });
          continue;
        }
        const restored = readSafely(record);
        if (!restored.ok) {
          cleanupUnverified = true;
          conflicts.push({
            kind: record.kind,
            reason: "restore-unverified",
            target: record.target,
          });
          continue;
        }
        const matchesOriginal = compareSafely(
          record,
          restored.state,
          record.originalState,
        );
        if (!matchesOriginal.ok || !matchesOriginal.equal) {
          cleanupUnverified = true;
          conflicts.push({
            kind: record.kind,
            reason: "restore-unverified",
            target: record.target,
          });
          continue;
        }
        restoredTargets += 1;
      }

      return freezeRestoreResult(
        conflicts,
        restoredTargets,
        cleanupUnverified,
      );
    },
  };
}

export function createTextMutationRecord(options: {
  readonly appliedValue: string;
  readonly target: Text;
}): MutationRecord<string> {
  return {
    kind: "text-data",
    target: options.target,
    originalState: options.target.data,
    appliedState: options.appliedValue,
    readState: () => options.target.data,
    writeState: (state) => {
      options.target.data = state;
    },
    statesEqual: Object.is,
    isEffective: () => options.target.data === options.appliedValue,
  };
}

type StyleState = {
  readonly priority: string;
  readonly value: string;
};

const styleStatesEqual = (a: StyleState, b: StyleState): boolean =>
  a.value === b.value && a.priority === b.priority;

export function createStyleMutationRecord(options: {
  readonly appliedPriority: string;
  readonly appliedValue: string;
  readonly property: string;
  readonly target: HTMLElement;
}): MutationRecord<StyleState> {
  const readState = (): StyleState => ({
    value: options.target.style.getPropertyValue(options.property),
    priority: options.target.style.getPropertyPriority(options.property),
  });
  return {
    kind: `style:${options.property}`,
    target: options.target,
    originalState: readState(),
    appliedState: {
      value: options.appliedValue,
      priority: options.appliedPriority,
    },
    readState,
    writeState: ({ value, priority }) => {
      if (value === "") {
        options.target.style.removeProperty(options.property);
        return;
      }
      options.target.style.setProperty(options.property, value, priority);
    },
    statesEqual: styleStatesEqual,
    isEffective: () =>
      styleStatesEqual(readState(), {
        value: options.appliedValue,
        priority: options.appliedPriority,
      }),
  };
}
