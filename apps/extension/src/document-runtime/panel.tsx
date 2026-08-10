// SPDX-License-Identifier: Apache-2.0

import { useSyncExternalStore } from "react";
import type { RunController, ScenarioId } from "@ui-torture-lab/engine";

type ExtensionPanelProps = {
  readonly collapsed: boolean;
  readonly onCollapse: () => void;
  readonly onExpand: () => void;
  readonly onRestore: () => void;
  readonly onStartScenario: (scenarioId: ScenarioId) => void;
  readonly runController: RunController;
};

export function ExtensionPanel({
  collapsed,
  onCollapse,
  onExpand,
  onRestore,
  onStartScenario,
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
        onStartScenario={onStartScenario}
        snapshot={snapshot}
      />
    </section>
  );
}

type RunControlsProps = Pick<
  ExtensionPanelProps,
  "onRestore" | "onStartScenario"
> & {
  readonly snapshot: ReturnType<RunController["getSnapshot"]>;
};

function RunControls({
  onRestore,
  onStartScenario,
  snapshot,
}: RunControlsProps) {
  if (snapshot.phase === "idle") {
    return (
      <div className="run-controls">
        <p>Apply one Scenario to the current Target Page.</p>
        <ScenarioButtons onStartScenario={onStartScenario} />
      </div>
    );
  }

  if (snapshot.phase === "applying-mutations") {
    return <p role="status">Applying {scenarioLabel(snapshot.scenarioId)}…</p>;
  }

  if (snapshot.phase === "ready-for-inspection") {
    return (
      <div className="run-controls">
        <p role="status">{scenarioLabel(snapshot.scenarioId)} Scenario active</p>
        <CoverageSummary coverage={snapshot.coverage} />
        <FindingSummary findings={snapshot.findings} />
        <button className="panel-action" onClick={onRestore} type="button">
          Restore
        </button>
      </div>
    );
  }

  if (snapshot.phase === "restoring") {
    return <p role="status">Restoring…</p>;
  }

  if (snapshot.phase === "aborted") {
    return (
      <div className="run-controls">
        <p role="alert">Run aborted</p>
        <p>No Findings were produced.</p>
        <RestoreSummary result={snapshot.result} />
        <p>{snapshot.result?.summary}</p>
        <ScenarioButtons onStartScenario={onStartScenario} />
      </div>
    );
  }

  if (snapshot.phase === "reload-required") {
    return (
      <div className="run-controls">
        {snapshot.result?.status === "aborted" ? (
          <p role="alert">Run aborted</p>
        ) : null}
        <p role="alert">Reload required</p>
        <RestoreSummary result={snapshot.result} />
        <p>{snapshot.result?.summary}</p>
      </div>
    );
  }

  return (
    <div className="run-controls">
      <p role="status">{scenarioLabel(snapshot.scenarioId)} Run completed</p>
      <CoverageSummary coverage={snapshot.coverage} />
      <FindingSummary findings={snapshot.findings} />
      <RestoreSummary result={snapshot.result} />
      <p>{snapshot.result?.summary}</p>
      <ScenarioButtons onStartScenario={onStartScenario} />
    </div>
  );
}

function FindingSummary({
  findings,
}: {
  readonly findings: ReturnType<RunController["getSnapshot"]>["findings"];
}) {
  if (findings.length === 0) {
    return <p>No Findings were produced.</p>;
  }
  return (
    <section aria-label="Findings">
      {(["text-clipping", "horizontal-containment-overflow", "viewport-overflow"] as const)
        .map((detectorId) => ({
          detectorId,
          findings: findings.filter((finding) => finding.detectorId === detectorId),
        }))
        .filter((group) => group.findings.length > 0)
        .map((group) => (
          <section aria-label={`${detectorLabel(group.detectorId)} Findings`} key={group.detectorId}>
            <strong>{detectorLabel(group.detectorId)}</strong>
            <ul>
              {group.findings.map((finding) => <FindingItem finding={finding} key={`${finding.locator}-${finding.measuredDelta}`} />)}
            </ul>
          </section>
        ))}
    </section>
  );
}

function detectorLabel(detectorId: ReturnType<RunController["getSnapshot"]>["findings"][number]["detectorId"]): string {
  switch (detectorId) {
    case "text-clipping":
      return "Text Clipping";
    case "horizontal-containment-overflow":
      return "Horizontal Containment Overflow";
    case "viewport-overflow":
      return "Viewport Overflow";
  }
}

function FindingItem({
  finding,
}: {
  readonly finding: ReturnType<RunController["getSnapshot"]>["findings"][number];
}) {
  return (
    <li>
      {finding.detectorId === "viewport-overflow" ? (
        <>Target Page · baseline {finding.baseline.documentExtent.toFixed(1)}px/{finding.baseline.viewportWidth.toFixed(1)}px · mutated {finding.mutated.documentExtent.toFixed(1)}px/{finding.mutated.viewportWidth.toFixed(1)}px · delta {finding.measuredDelta.toFixed(1)}px · {finding.contributionSide} via {finding.primaryContributor.locator} ({finding.primaryContributor.baseline.left.toFixed(1)}–{finding.primaryContributor.baseline.right.toFixed(1)}px → {finding.primaryContributor.mutated.left.toFixed(1)}–{finding.primaryContributor.mutated.right.toFixed(1)}px; contribution {finding.primaryContributor.contribution.toFixed(1)}px). Contributors: {finding.contributors.map((contributor) => `${contributor.contributionSide} ${contributor.locator} ${contributor.contribution.toFixed(1)}px`).join("; ")}. {finding.possibleCause}</>
      ) : <>Boundary {finding.locator} · {finding.detectorId === "text-clipping"
        ? `hidden extent ${finding.mutated.hiddenExtent.toFixed(1)}px`
        : `maximum excess ${finding.mutated.maximumExcess.toFixed(1)}px`}</>}
    </li>
  );
}

const scenarioLabel = (scenarioId: ScenarioId | null): string => {
  switch (scenarioId) {
    case "large-text":
      return "Large Text";
    case "long-text":
      return "Long Text";
    case "unbreakable-text":
      return "Unbreakable Text";
    case null:
      return "Scenario";
  }
};

function ScenarioButtons({
  onStartScenario,
}: {
  readonly onStartScenario: (scenarioId: ScenarioId) => void;
}) {
  return (
    <>
      <button
        className="panel-action"
        onClick={() => onStartScenario("large-text")}
        type="button"
      >
        Apply Large Text
      </button>
      <button
        className="panel-action"
        onClick={() => onStartScenario("long-text")}
        type="button"
      >
        Apply Long Text
      </button>
      <button
        className="panel-action"
        onClick={() => onStartScenario("unbreakable-text")}
        type="button"
      >
        Apply Unbreakable Text
      </button>
    </>
  );
}

function RestoreSummary({
  result,
}: {
  readonly result: ReturnType<RunController["getSnapshot"]>["result"];
}) {
  if (result?.restore.status === "restored") {
    return <p>Restore completed</p>;
  }
  if (result?.restore.status === "conflict") {
    return (
      <p>
        Restore conflict · {result.restore.conflicts.length} external change(s).
        External changes were left untouched.
      </p>
    );
  }
  if (result?.restore.status === "unverified") {
    return (
      <p>
        Restore unverified · {result.restore.conflicts.length} cleanup problem(s).
        External changes were left untouched.
      </p>
    );
  }
  return null;
}

function CoverageSummary({
  coverage,
}: {
  readonly coverage: ReturnType<RunController["getSnapshot"]>["coverage"];
}) {
  return (
    <p>
      {coverage.eligibleTargets} eligible · {coverage.mutatedTargets} mutated ·{" "}
      {coverage.excludedTargets} excluded ·{" "}
      {coverage.skippedTargets} skipped · {coverage.safeFailedTargets} safe-failed ·{" "}
      {coverage.ineffectiveTargets} ineffective · {coverage.comparableTargets} comparable
      · {coverage.inconclusiveTargets} inconclusive · {coverage.contributorTargets} contributors
      · {coverage.findingCount} Findings
    </p>
  );
}
