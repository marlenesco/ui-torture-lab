// SPDX-License-Identifier: Apache-2.0

export const panelCss = `
  :host {
    all: initial;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  button {
    font: inherit;
  }

  .panel-shell,
  .panel-toggle--expand {
    position: fixed;
    inset-block-start: 12px;
    inset-inline-end: 12px;
    z-index: 2147483647;
    color: #f7f7f2;
    background: #191a17;
    border: 1px solid #41433c;
    box-shadow: 0 16px 48px rgb(0 0 0 / 35%);
    font: 14px/1.4 system-ui, sans-serif;
    pointer-events: auto;
  }

  .panel-shell {
    inline-size: min(360px, calc(100vw - 24px));
    max-block-size: calc(100vh - 24px);
    overflow: auto;
    border-radius: 12px;
    padding: 16px;
  }

  .panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .panel-header div {
    display: grid;
    gap: 2px;
  }

  .panel-header span,
  .panel-shell p {
    color: #b9bbb2;
  }

  .panel-shell p {
    margin: 16px 0 0;
  }

  .panel-toggle {
    appearance: none;
    border: 1px solid #65685f;
    border-radius: 7px;
    color: inherit;
    background: #2a2c27;
    padding: 6px 9px;
    cursor: pointer;
  }

  .panel-toggle:focus-visible {
    outline: 2px solid #d7f36b;
    outline-offset: 2px;
  }

  .run-controls {
    display: grid;
    gap: 12px;
    margin-block-start: 16px;
  }

  .run-controls p {
    margin: 0;
  }

  .markdown-report {
    display: grid;
    gap: 12px;
    margin-block-start: 16px;
  }

  .markdown-report textarea {
    display: block;
    inline-size: 100%;
    margin-block-start: 8px;
    color: inherit;
    background: #2a2c27;
    font: 12px/1.4 monospace;
    white-space: pre;
    resize: vertical;
    user-select: text;
  }

  .markdown-report textarea:focus-visible {
    outline: 2px solid #d7f36b;
    outline-offset: 2px;
  }

  .panel-action {
    appearance: none;
    justify-self: start;
    border: 1px solid #d7f36b;
    border-radius: 7px;
    color: #191a17;
    background: #d7f36b;
    padding: 8px 12px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .panel-action:focus-visible {
    outline: 2px solid #f7f7f2;
    outline-offset: 2px;
  }

  .finding-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .panel-toggle--expand {
    margin: 0;
    padding: 9px 11px;
    border-radius: 999px;
  }
`;
