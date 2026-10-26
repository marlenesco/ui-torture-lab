// SPDX-License-Identifier: Apache-2.0

import { useId, useRef, useState, useSyncExternalStore } from "react";
import type { MarkdownReportInput, RunController, ScenarioId } from "@ui-torture-lab/engine";
import { MarkdownReport } from "./markdown-report";
import { PanelIcon } from "./panel-icon";
import { BrandLogo } from "./brand-logo";
import { PanelHelp } from "./panel-help";
import { LocatorCopy } from "./locator-copy";

type ExtensionPanelProps = {
  readonly collapsed: boolean;
  readonly authorized: boolean;
  readonly canStartScenario: boolean;
  readonly navigationComplete: boolean;
  readonly currentRunReport: MarkdownReportInput | null;
  readonly onClearPreviousRunResult: () => void;
  readonly liveFindingMessage: string | null;
  readonly previousRunResult: MarkdownReportInput | null;
  readonly onCollapse: () => void;
  readonly onClose: () => void;
  readonly onExpand: () => void;
  readonly onInspectFinding: (
    finding: ReturnType<RunController["getSnapshot"]>["findings"][number],
    action: "highlight-ranges" | "highlight-subject" | "navigate",
  ) => void;
  readonly isFindingActionEnabled: (
    finding: ReturnType<RunController["getSnapshot"]>["findings"][number],
  ) => boolean;
  readonly onRestore: () => void;
  readonly onStartScenario: (scenarioId: ScenarioId) => void;
  readonly runController: RunController;
};

export function ExtensionPanel({
  collapsed,
  authorized,
  canStartScenario,
  navigationComplete,
  currentRunReport,
  onClearPreviousRunResult,
  liveFindingMessage,
  previousRunResult,
  onCollapse,
  onClose,
  onExpand,
  onInspectFinding,
  isFindingActionEnabled,
  onRestore,
  onStartScenario,
  runController,
}: ExtensionPanelProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpId = useId();
  const helpButton = useRef<HTMLButtonElement>(null);
  const closeHelp = () => {
    setHelpOpen(false);
    helpButton.current?.focus();
  };
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
        <PanelIcon name="expand" />UTL
      </button>
    );
  }

  return (
    <section aria-label="UI Torture Lab" className="panel-shell" onKeyDown={(event) => {
      if (event.key === "Escape" && helpOpen) {
        event.preventDefault();
        event.stopPropagation();
        closeHelp();
      }
    }}>
      <header className="panel-header">
        <div className="panel-brand">
          <BrandLogo />
          <div>
            <strong>UI Torture Lab</strong>
            <span className="panel-authorization" data-ready={canStartScenario}>{authorized ? "Target Page authorized" : "Target Page authorization ended"}</span>
          </div>
        </div>
        <div className="panel-window-actions">
          <button
            aria-controls={helpId}
            aria-expanded={helpOpen}
            aria-haspopup="dialog"
            aria-label="Quick guide"
            className="panel-plain-button"
            onClick={() => helpOpen ? closeHelp() : setHelpOpen(true)}
            ref={helpButton}
            title="Quick guide to panel actions"
            type="button"
          >
            <PanelIcon name="info" plain />
          </button>
          <button
            aria-label="Collapse UI Torture Lab"
            className="panel-toggle panel-icon-button"
            onClick={() => { setHelpOpen(false); onCollapse(); }}
            title="Collapse panel"
            type="button"
          >
            <PanelIcon name="collapse" />
          </button>
          <button
            aria-label="Close UI Torture Lab"
            className="panel-toggle panel-icon-button"
            onClick={onClose}
            title="Close panel; reopen from the browser toolbar"
            type="button"
          >
            <PanelIcon name="close" />
          </button>
        </div>
      </header>
      {helpOpen ? <PanelHelp id={helpId} onClose={closeHelp} /> : null}
      {liveFindingMessage === null ? null : <p className="panel-message" role="status">{liveFindingMessage}</p>}
      {!navigationComplete ? <p role="status">Navigation observation is incomplete. Restore before changing SPA routes.</p> : null}
      <RunControls
        authorized={authorized}
        canStartScenario={canStartScenario}
        onRestore={onRestore}
        onClearPreviousRunResult={onClearPreviousRunResult}
        onInspectFinding={onInspectFinding}
        isFindingActionEnabled={isFindingActionEnabled}
        onStartScenario={onStartScenario}
        previousRunResult={previousRunResult}
        snapshot={snapshot}
      />
      {snapshot.result !== null && currentRunReport?.result === snapshot.result
        ? <MarkdownReport report={currentRunReport} />
        : null}
    </section>
  );
}

type RunControlsProps = Pick<
  ExtensionPanelProps,
  | "isFindingActionEnabled"
  | "onInspectFinding"
  | "onRestore"
  | "onStartScenario"
> & {
  readonly onClearPreviousRunResult: ExtensionPanelProps["onClearPreviousRunResult"];
  readonly previousRunResult: ExtensionPanelProps["previousRunResult"];
  readonly snapshot: ReturnType<RunController["getSnapshot"]>;
  readonly authorized: boolean;
  readonly canStartScenario: boolean;
};

function RunControls({
  authorized,
  canStartScenario,
  onInspectFinding,
  onClearPreviousRunResult,
  isFindingActionEnabled,
  onRestore,
  onStartScenario,
  previousRunResult,
  snapshot,
}: RunControlsProps) {
  if (snapshot.phase === "idle" || !authorized) {
    return (
      <div className="run-controls">
        {previousRunResult === null ? null : (
          <section aria-label="Previous Target Snapshot">
            <p role="status">Previous Target Snapshot · {previousRunResult.page.origin}{previousRunResult.page.pathname}</p>
            <CoverageSummary coverage={previousRunResult.result.coverage} />
            <FindingSummary
              findings={previousRunResult.result.findings}
              isFindingActionEnabled={undefined}
              onInspectFinding={undefined}
            />
            <RestoreSummary result={previousRunResult.result} />
            <p>{previousRunResult.result.summary}</p>
            <MarkdownReport report={previousRunResult} />
            <button className="panel-toggle" onClick={onClearPreviousRunResult} title="Delete this tab's saved snapshot; downloaded files remain" type="button">
              <PanelIcon name="clear" />Clear saved result
            </button>
          </section>
        )}
        {authorized ? <>
          <p>Apply one Scenario to the current Target Page.</p>
          <ScenarioButtons disabled={!canStartScenario} onStartScenario={onStartScenario} />
        </> : <p role="alert">{snapshot.phase === "reload-required" ? "Reload required. Previous Mutations could not be safely restored." : "Click the toolbar action again to authorize the new Target Page."}</p>}
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
        <FindingSummary
          findings={snapshot.findings}
          isFindingActionEnabled={isFindingActionEnabled}
          onInspectFinding={onInspectFinding}
        />
        <button className="panel-action" onClick={onRestore} title="Reverse owned changes, clear outlines and complete this Run" type="button">
          <PanelIcon name="restore" />Restore
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
        <ScenarioButtons disabled={!canStartScenario} onStartScenario={onStartScenario} />
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
      <FindingSummary
        findings={snapshot.findings}
        isFindingActionEnabled={undefined}
        onInspectFinding={undefined}
      />
      <RestoreSummary result={snapshot.result} />
      <p>{snapshot.result?.summary}</p>
      <ScenarioButtons disabled={!canStartScenario} onStartScenario={onStartScenario} />
    </div>
  );
}

function FindingSummary({
  findings,
  onInspectFinding,
  isFindingActionEnabled,
}: {
  readonly findings: ReturnType<RunController["getSnapshot"]>["findings"];
  readonly onInspectFinding: ExtensionPanelProps["onInspectFinding"] | undefined;
  readonly isFindingActionEnabled:
    | ExtensionPanelProps["isFindingActionEnabled"]
    | undefined;
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
            <ul className="finding-list">
              {group.findings.map((finding) => (
                <FindingItem
                  finding={finding}
                  isFindingActionEnabled={isFindingActionEnabled}
                  key={`${finding.locator}-${finding.measuredDelta}`}
                  onInspectFinding={onInspectFinding}
                />
              ))}
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
  onInspectFinding,
  isFindingActionEnabled,
}: {
  readonly finding: ReturnType<RunController["getSnapshot"]>["findings"][number];
  readonly onInspectFinding: ExtensionPanelProps["onInspectFinding"] | undefined;
  readonly isFindingActionEnabled:
    | ExtensionPanelProps["isFindingActionEnabled"]
    | undefined;
}) {
  const locatorElement = useRef<HTMLElement>(null);
  return (
    <li>
      <article aria-label={`Finding detail ${finding.locator}`}>
        <strong>Finding detail · <code data-ui-torture-lab-diagnostic-locator="" ref={locatorElement}>{finding.locator}</code></strong>
        <p>{finding.detectorId === "viewport-overflow"
          ? `Target Page · baseline ${finding.baseline.documentExtent.toFixed(1)}px/${finding.baseline.viewportWidth.toFixed(1)}px · mutated ${finding.mutated.documentExtent.toFixed(1)}px/${finding.mutated.viewportWidth.toFixed(1)}px · delta ${finding.measuredDelta.toFixed(1)}px · ${finding.contributionSide} via ${finding.primaryContributor.locator} (${finding.primaryContributor.baseline.left.toFixed(1)}–${finding.primaryContributor.baseline.right.toFixed(1)}px → ${finding.primaryContributor.mutated.left.toFixed(1)}–${finding.primaryContributor.mutated.right.toFixed(1)}px; contribution ${finding.primaryContributor.contribution.toFixed(1)}px). Contributors: ${finding.contributors.map((contributor) => `${contributor.contributionSide} ${contributor.locator} ${contributor.contribution.toFixed(1)}px`).join("; ")}.`
          : `Boundary ${finding.locator}; delta ${finding.measuredDelta.toFixed(1)}px.`}</p>
        <p><strong>Evidence</strong> · {finding.detectorId === "text-clipping"
          ? `visible ${finding.baseline.visibleExtent.toFixed(1)}px; hidden ${finding.mutated.hiddenExtent.toFixed(1)}px; ${finding.affectedRanges.length} affected range(s).`
          : finding.detectorId === "horizontal-containment-overflow"
            ? `maximum excess ${finding.baseline.maximumExcess.toFixed(1)}px → ${finding.mutated.maximumExcess.toFixed(1)}px; ${finding.affectedElementCount} affected element(s).`
            : `${finding.contributors.length} contributor(s); ${finding.contributionSide} excess.`}</p>
        {finding.detectorId === "text-clipping" ? (
          <p><strong>Computed CSS</strong> · overflow-x: {finding.computedStyles.overflowX}; overflow-y: {finding.computedStyles.overflowY}; white-space: {finding.computedStyles.whiteSpace}.</p>
        ) : null}
        <p><strong>Possible Cause</strong> · {finding.possibleCause}</p>
        {onInspectFinding === undefined ? null : <div className="finding-actions">
          <button
            aria-label={`Highlight Finding Subject ${finding.locator}`}
            className="panel-toggle"
            disabled={isFindingActionEnabled?.(finding) === false}
            onClick={() => onInspectFinding(finding, "highlight-subject")}
            title="Scroll to and outline the responsible boundary or Primary Contributor"
            type="button"
          >
            <PanelIcon name="highlight" />Highlight subject
          </button>
          <button
            aria-label={`Navigate to Finding Subject ${finding.locator}`}
            className="panel-toggle"
            disabled={isFindingActionEnabled?.(finding) === false}
            onClick={() => onInspectFinding(finding, "navigate")}
            title="Scroll to the subject without adding an outline"
            type="button"
          >
            <PanelIcon name="navigate" />Navigate
          </button>
          {finding.detectorId === "text-clipping" ? (
            <button
              aria-label={`Highlight affected ranges for ${finding.locator}`}
              className="panel-toggle"
              disabled={isFindingActionEnabled?.(finding) === false}
              onClick={() => onInspectFinding(finding, "highlight-ranges")}
              title="Reveal the first affected text and outline its ranges"
              type="button"
            >
              <PanelIcon name="highlight" />Highlight ranges
            </button>
          ) : null}
          <LocatorCopy locator={finding.locator} target={locatorElement} />
        </div>}
      </article>
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
  disabled,
  onStartScenario,
}: {
  readonly disabled: boolean;
  readonly onStartScenario: (scenarioId: ScenarioId) => void;
}) {
  return (
    <div className="scenario-actions">
      <button
        className="panel-action"
        disabled={disabled}
        onClick={() => onStartScenario("large-text")}
        title="Temporarily enlarge eligible text"
        type="button"
      >
        <PanelIcon name="large-text" />Apply Large Text
      </button>
      <button
        className="panel-action"
        disabled={disabled}
        onClick={() => onStartScenario("long-text")}
        title="Temporarily repeat eligible text"
        type="button"
      >
        <PanelIcon name="long-text" />Apply Long Text
      </button>
      <button
        className="panel-action"
        disabled={disabled}
        onClick={() => onStartScenario("unbreakable-text")}
        title="Temporarily add a long unbreakable token to eligible text"
        type="button"
      >
        <PanelIcon name="unbreakable-text" />Apply Unbreakable Text
      </button>
    </div>
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
    <p className="coverage-summary">
      {coverage.eligibleTargets} eligible · {coverage.mutatedTargets} mutated ·{" "}
      {coverage.excludedTargets} excluded ·{" "}
      {coverage.skippedTargets} skipped · {coverage.safeFailedTargets} safe-failed ·{" "}
      {coverage.ineffectiveTargets} ineffective · {coverage.comparableTargets} comparable
      · {coverage.inconclusiveTargets} inconclusive · {coverage.contributorTargets} contributors
      · {coverage.findingCount} Findings
    </p>
  );
}
