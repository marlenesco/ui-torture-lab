// SPDX-License-Identifier: Apache-2.0

type ExtensionPanelProps = {
  readonly collapsed: boolean;
  readonly onCollapse: () => void;
  readonly onExpand: () => void;
};

export function ExtensionPanel({
  collapsed,
  onCollapse,
  onExpand,
}: ExtensionPanelProps) {
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
      <p>The control shell is ready for a Scenario.</p>
    </section>
  );
}
