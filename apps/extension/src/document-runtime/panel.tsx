// SPDX-License-Identifier: Apache-2.0

import { useSyncExternalStore } from "react";
import type { RunController } from "@ui-torture-lab/engine";

type ExtensionPanelProps = {
  readonly collapsed: boolean;
  readonly onCollapse: () => void;
  readonly onExpand: () => void;
  readonly onRestore: () => void;
  readonly onStartLongText: () => void;
  readonly runController: RunController;
};

export function ExtensionPanel({
  collapsed,
  onCollapse,
  onExpand,
  onRestore,
  onStartLongText,
  runController,
}: ExtensionPanelProps) {
  const snapshot = useSyncExternalStore(
    runController.subscribe,
    runController.getSnapshot,
    runController.getSnapshot,
  );

  if (collapsed) {
    return (
      <button
        aria-label="Expand UI Torture Lab"
        className="panel-toggle panel-toggle--expand"
        onClick={onExpand}
        type="button"
      >
        UTL
      </button>
    );
  }

  return (
    <section aria-label="UI Torture Lab" className="panel-shell">
      <header className="panel-header">
        <div>
          <strong>UI Torture Lab</strong>
          <span>Target Page authorized</span>
        </div>
        <button
          aria-label="Collapse UI Torture Lab"
          className="panel-toggle"
          onClick={onCollapse}
          type="button"
        >
          Collapse
        </button>
      </header>
      <RunControls
        onRestore={onRestore}
        onStartLongText={onStartLongText}
        snapshot={snapshot}
      />
    </section>
  );
}

type RunControlsProps = Pick<
  ExtensionPanelProps,
  "onRestore" | "onStartLongText"
> & {
  readonly snapshot: ReturnType<RunController["getSnapshot"]>;
};

function RunControls({
  onRestore,
  onStartLongText,
  snapshot,
}: RunControlsProps) {
  if (snapshot.phase === "idle") {
    return (
      <div className="run-controls">
        <p>Apply one Scenario to the current Target Page.</p>
        <button className="panel-action" onClick={onStartLongText} type="button">
          Apply Long Text
        </button>
      </div>
    );
  }

  if (snapshot.phase === "applying-mutations") {
    return <p role="status">Applying Long Text…</p>;
  }

  if (snapshot.phase === "ready-for-inspection") {
    return (
      <div className="run-controls">
        <p role="status">Long Text Scenario active</p>
        <CoverageSummary coverage={snapshot.coverage} />
        <button className="panel-action" onClick={onRestore} type="button">
          Restore
        </button>
      </div>
    );
  }

  if (snapshot.phase === "restoring") {
    return <p role="status">Restoring…</p>;
  }

  if (snapshot.phase === "reload-required") {
    return <p role="alert">Restore could not be verified. Reload required.</p>;
  }

  return (
    <div className="run-controls">
      <p role="status">Run completed</p>
      <CoverageSummary coverage={snapshot.coverage} />
      <p>{snapshot.result?.summary}</p>
      <button className="panel-action" onClick={onStartLongText} type="button">
        Apply Long Text
      </button>
    </div>
  );
}

function CoverageSummary({
  coverage,
}: {
  readonly coverage: ReturnType<RunController["getSnapshot"]>["coverage"];
}) {
  return (
    <p>
      {coverage.eligibleTargets} eligible · {coverage.mutatedTargets} mutated ·{" "}
      {coverage.skippedTargets} skipped · {coverage.ineffectiveTargets} ineffective
      · {coverage.inconclusiveTargets} inconclusive
    </p>
  );
}
