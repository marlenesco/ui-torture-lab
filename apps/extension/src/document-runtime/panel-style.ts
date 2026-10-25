// SPDX-License-Identifier: Apache-2.0

export const panelCss = `
  :host {
    all: initial;
  }
  *, *::before, *::after {
    box-sizing: border-box;
  }

  .panel-shell,
  .panel-toggle--expand {
    --panel-accent: #d7f36b;
    --panel-muted: #aeb6a8;
    --panel-line: #343c32;
    position: fixed;
    inset-block-start: 12px;
    inset-inline-end: 12px;
    z-index: 2147483647;
    color: #eef2e9;
    background: #191d18;
    border: 1px solid var(--panel-line);
    box-shadow: 0 12px 36px rgb(0 0 0 / 28%);
    font: 13px/1.5 system-ui, sans-serif;
    color-scheme: dark;
    pointer-events: auto;
  }

  .panel-shell {
    inline-size: min(360px, calc(100vw - 24px));
    max-block-size: calc(100vh - 24px);
    overflow: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    border-radius: 14px;
    padding: 18px;
    overflow-wrap: anywhere;
  }

  .panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding-block-end: 16px;
    border-block-end: 1px solid var(--panel-line);
  }

  .panel-header div {
    display: grid;
    gap: 5px;
    min-inline-size: 0;
  }
  .panel-header .panel-brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .panel-logo {
    inline-size: 36px;
    block-size: 42px;
    flex: 0 0 36px;
  }
  .panel-header .panel-window-actions {
    display: flex;
    flex: 0 0 auto;
    gap: 4px;
  }
  .panel-icon {
    flex: 0 0 26px;
    inline-size: 26px;
    block-size: 26px;
    padding: 5px;
    border-radius: 7px;
    background: var(--panel-accent);
    color: #191d18;
  }
  .panel-toggle,
  .panel-action {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .panel-shell .panel-icon-button {
    inline-size: 30px;
    min-block-size: 30px;
    padding: 2px;
    justify-content: center;
  }
  .panel-header strong {
    font-size: 17px;
    font-weight: 650;
    letter-spacing: -0.03em;
    line-height: 1.25;
  }
  .panel-authorization {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--panel-muted);
  }
  .panel-authorization::before {
    content: '';
    flex: 0 0 5px;
    block-size: 5px;
    border-radius: 50%;
    background: #818b7a;
  }
  .panel-authorization[data-ready="true"]::before {
    background: var(--panel-accent);
  }
  .panel-shell p {
    margin: 0;
    color: var(--panel-muted);
  }
  .panel-shell > p {
    margin-block-start: 14px;
  }
  .panel-message {
    font-size: 12px;
  }
  .panel-shell [role="alert"] {
    padding-inline-start: 10px;
    border-inline-start: 2px solid var(--panel-accent);
    color: #eef2e9;
  }

  button {
    font: inherit;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }

  .panel-toggle,
  .panel-action {
    appearance: none;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
    transition: color 120ms ease;
  }

  .panel-toggle {
    min-block-size: 32px;
    color: #d7ded1;
    background: transparent;
    padding: 3px 4px;
    font-size: 12px;
    font-weight: 550;
  }

  .panel-toggle:hover:enabled {
    color: var(--panel-accent);
  }
  .panel-toggle:active:enabled {
    color: #bddb60;
  }
  button:focus-visible,
  .markdown-report textarea:focus-visible {
    outline: 2px solid var(--panel-accent);
    outline-offset: 3px;
  }

  .run-controls {
    display: grid;
    gap: 14px;
    margin-block-start: 16px;
  }
  .run-controls > [role="status"] {
    color: #eef2e9;
    font-weight: 600;
  }
  .scenario-actions {
    display: grid;
    gap: 8px;
  }

  .panel-action {
    min-block-size: 42px;
    justify-self: stretch;
    color: var(--panel-accent);
    background: transparent;
    padding: 8px 4px;
    text-align: start;
    font-weight: 650;
  }

  .panel-action:hover:enabled {
    color: #e4ff87;
  }
  .panel-action:active:enabled {
    color: #bddb60;
  }

  .panel-shell button:disabled {
    color: #9da694;
    background: transparent;
    border: 0;
    text-decoration: none;
    font-weight: 500;
    cursor: not-allowed;
    opacity: 1;
  }

  .panel-toggle:hover:enabled .panel-icon,
  .panel-action:hover:enabled .panel-icon {
    background: #e4ff87;
  }
  .panel-shell button:disabled .panel-icon {
    background: #626e55;
  }

  .coverage-summary {
    font-size: 11px;
    line-height: 1.7;
    font-variant-numeric: tabular-nums;
  }
  .finding-list {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
  }
  .finding-list li {
    padding-block: 12px;
    border-block-start: 1px solid var(--panel-line);
  }
  .finding-list li:last-child {
    padding-block-end: 0;
  }
  .finding-list article {
    display: grid;
    gap: 8px;
    font-size: 12px;
  }
  .finding-list strong {
    font-weight: 600;
  }
  .finding-list code {
    font-size: 11px;
  }
  .finding-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-block-start: 2px;
  }
  .finding-actions .panel-toggle {
    min-block-size: 30px;
    font-size: 11px;
  }

  .markdown-report {
    display: grid;
    gap: 12px;
    margin-block-start: 18px;
    padding-block-start: 16px;
    border-block-start: 1px solid var(--panel-line);
  }
  .markdown-report label {
    font-size: 11px;
    color: var(--panel-muted);
  }
  .markdown-report textarea {
    display: block;
    inline-size: 100%;
    margin-block-start: 7px;
    border: 1px solid var(--panel-line);
    border-radius: 8px;
    padding: 10px;
    color: #d7ded1;
    background: #12160f;
    font: 11px/1.6 ui-monospace, monospace;
    white-space: pre;
    resize: vertical;
    user-select: text;
  }

  .panel-toggle--expand {
    background: #191d18;
    margin: 0;
    padding: 9px 12px;
    border-radius: 999px;
    font-weight: 650;
    letter-spacing: 0.04em;
  }
  @media (prefers-reduced-motion: reduce) {
    .panel-toggle, .panel-action {
      transition: none;
    }
  }
`;
