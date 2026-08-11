// SPDX-License-Identifier: Apache-2.0

import { createRoot, type Root } from "react-dom/client";
import { createRunController, type RunController } from "@ui-torture-lab/engine";
import { browser } from "wxt/browser";
import { ExtensionPanel } from "./panel";
import {
  isStoredRunResult,
  pageMetadataFor,
  type StoredRunResult,
} from "../target-page/current-run-result";
import {
  clearRunResultMessageType,
  readRunResultMessageType,
  runActivityMessageType,
  storeRunResultMessageType,
} from "../target-page/messages";

const runtimeKey = Symbol.for("ui-torture-lab/document-runtime");

const isolatedUiEventTypes = [
  "auxclick",
  "beforeinput",
  "change",
  "click",
  "compositionend",
  "compositionstart",
  "contextmenu",
  "dblclick",
  "dragend",
  "dragenter",
  "dragleave",
  "dragover",
  "dragstart",
  "drop",
  "focusin",
  "focusout",
  "input",
  "keydown",
  "keypress",
  "keyup",
  "mousedown",
  "mousemove",
  "mouseout",
  "mouseover",
  "mouseup",
  "pointercancel",
  "pointerdown",
  "pointermove",
  "pointerout",
  "pointerover",
  "pointerup",
  "submit",
  "touchcancel",
  "touchend",
  "touchmove",
  "touchstart",
  "wheel",
] as const;

const panelCss = `
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

type MountedPanel = {
  readonly host: HTMLElement;
  readonly root: Root;
  readonly shadow: ShadowRoot;
  render(collapsed: boolean): void;
  remove(): void;
};

type MountedOverlay = {
  readonly container: HTMLElement;
  readonly host: HTMLElement;
  readonly shadow: ShadowRoot;
  remove(): void;
};

type RuntimeDiagnostics = {
  readonly diagnosticHighlightCount: number;
  readonly diagnosticHighlightsRendered: number;
  readonly ownedRootCount: number;
  readonly overlayRendered: boolean;
  readonly panelRendered: boolean;
  readonly ownsOverlay: boolean;
  readonly ownsPanel: boolean;
};

type Rect = {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
};

type FindingAction =
  | "copy-locator"
  | "highlight-ranges"
  | "highlight-subject"
  | "navigate";

class ExtensionDomOwnership {
  private readonly roots = new Set<Node>();

  add(...roots: readonly Node[]): void {
    for (const root of roots) {
      this.roots.add(root);
    }
  }

  delete(...roots: readonly Node[]): void {
    for (const root of roots) {
      this.roots.delete(root);
    }
  }

  owns(node: Node): boolean {
    for (const root of this.roots) {
      if (node === root) {
        return true;
      }
      if (root instanceof ShadowRoot && node.getRootNode() === root) {
        return true;
      }
      if (root instanceof Element && root.contains(node)) {
        return true;
      }
    }
    return false;
  }

  get size(): number {
    return this.roots.size;
  }
}

type InlineDisplay = {
  readonly priority: string;
  readonly value: string;
};

const hideForMeasurement = (host: HTMLElement): (() => void) => {
  const previous: InlineDisplay = {
    value: host.style.getPropertyValue("display"),
    priority: host.style.getPropertyPriority("display"),
  };
  host.style.setProperty("display", "none", "important");

  return () => {
    if (previous.value === "") {
      host.style.removeProperty("display");
      return;
    }
    host.style.setProperty("display", previous.value, previous.priority);
  };
};

const configureZeroFootprintHost = (
  host: HTMLElement,
  zIndex: string,
): void => {
  host.style.setProperty("all", "initial", "important");
  host.style.setProperty("display", "block", "important");
  host.style.setProperty("position", "fixed", "important");
  host.style.setProperty("inset", "0 auto auto 0", "important");
  host.style.setProperty("width", "0", "important");
  host.style.setProperty("height", "0", "important");
  host.style.setProperty("margin", "0", "important");
  host.style.setProperty("overflow", "visible", "important");
  host.style.setProperty("pointer-events", "none", "important");
  host.style.setProperty("z-index", zIndex, "important");
};

const isolateUiEvents = (shadow: ShadowRoot): void => {
  for (const eventType of isolatedUiEventTypes) {
    shadow.addEventListener(eventType, (event) => {
      event.stopPropagation();
    });
  }
};

type DocumentRuntimeGlobal = typeof globalThis & {
  [runtimeKey]?: DocumentRuntime;
};

class DocumentRuntime {
  readonly document = document;
  readonly runtimeId = crypto.randomUUID();
  readonly runController: RunController;
  private readonly ownership = new ExtensionDomOwnership();
  private readonly diagnosticHighlights = new Set<HTMLElement>();
  private readonly invalidLiveFindings = new Set<
    ReturnType<RunController["getSnapshot"]>["findings"][number]
  >();
  private storedResult: ReturnType<RunController["getSnapshot"]>["result"] = null;
  private previousRunResult: StoredRunResult | null = null;
  private reportedRunActivity: boolean | null = null;
  private liveFindingMessage: string | null = null;
  private overlay: MountedOverlay | undefined;
  private panel: MountedPanel | undefined;

  constructor() {
    this.runController = createRunController({
      document: this.document,
      isExtensionOwnedNode: (node) => this.isExtensionOwnedNode(node),
    });
    this.runController.subscribe(() => {
      const snapshot = this.runController.getSnapshot();
      if (snapshot.phase !== "ready-for-inspection") {
        this.invalidLiveFindings.clear();
      }
      if (snapshot.result !== null && snapshot.result !== this.storedResult) {
        this.storedResult = snapshot.result;
        this.storeCurrentRunResult(snapshot.result);
      }
      this.reportRunActivity();
    });
    this.document.defaultView?.addEventListener("pagehide", () =>
      this.clearRunActivity(),
    );
  }

  mountOrReveal(): void {
    if (this.panel?.host.isConnected) {
      this.panel.render(false);
      this.ensureOverlay();
      this.reportRunActivity();
      return;
    }

    this.panel?.remove();
    this.panel = this.mountPanel();
    this.ensureOverlay();
    this.reportRunActivity();
    this.loadPreviousRunResult();
  }

  isExtensionOwnedNode(node: Node): boolean {
    return this.ownership.owns(node);
  }

  showDiagnosticHighlight(rect: Rect, kind: "range" | "subject" = "subject"): void {
    const overlay = this.ensureOverlay();
    const highlight = document.createElement("div");
    highlight.dataset.uiTortureLabHighlight = "";
    highlight.dataset.uiTortureLabHighlightKind = kind;
    highlight.style.cssText = [
      "position:fixed",
      `inset:${rect.y}px auto auto ${rect.x}px`,
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      "box-sizing:border-box",
      "border:2px solid #d7f36b",
      "pointer-events:none",
    ].join(";");
    overlay.container.append(highlight);
    this.diagnosticHighlights.add(highlight);
  }

  clearDiagnosticHighlights(): void {
    for (const highlight of this.diagnosticHighlights) {
      highlight.remove();
    }
    this.diagnosticHighlights.clear();
  }

  inspectFinding(
    finding: ReturnType<RunController["getSnapshot"]>["findings"][number],
    action: FindingAction,
  ): void {
    if (action === "copy-locator") {
      this.selectDiagnosticLocator(finding.locator);
      return;
    }

    const reference = this.runController.getLiveFindingReference(finding);
    if (reference === null) {
      this.disableFindingActions(finding);
      return;
    }

    const subject = reference.subject ?? reference.primaryContributor;
    if (
      subject === null ||
      !subject.isConnected ||
      subject.ownerDocument !== this.document
    ) {
      this.disableFindingActions(finding);
      return;
    }

    if (action === "navigate") {
      subject.scrollIntoView({ block: "center", inline: "nearest" });
      this.setLiveFindingMessage(`Navigated to ${finding.locator}.`);
      return;
    }

    this.clearDiagnosticHighlights();
    if (action === "highlight-subject") {
      this.showDiagnosticHighlight(subject.getBoundingClientRect(), "subject");
      this.setLiveFindingMessage(`Highlighted ${finding.locator}.`);
      return;
    }

    const rectangles = reference.affectedRanges.flatMap((target) => {
      if (!target.isConnected || target.ownerDocument !== this.document) return [];
      const range = this.document.createRange();
      range.selectNodeContents(target);
      return [...range.getClientRects()];
    });
    if (rectangles.length === 0) {
      this.disableFindingActions(finding);
      return;
    }
    for (const rectangle of rectangles) {
      this.showDiagnosticHighlight(rectangle, "range");
    }
    this.setLiveFindingMessage("Highlighted affected ranges.");
  }

  async withMeasurementSafeUi<T>(measure: () => T | Promise<T>): Promise<T> {
    const restoreVisibility = [this.panel?.host, this.overlay?.host]
      .filter((host): host is HTMLElement => host !== undefined)
      .map(hideForMeasurement);

    try {
      return await measure();
    } finally {
      for (const restore of restoreVisibility.reverse()) {
        restore();
      }
    }
  }

  getDiagnostics(): RuntimeDiagnostics {
    const overlayRendered = this.isRendered(this.overlay?.host);
    const panelRendered = this.isRendered(this.panel?.host);
    return {
      diagnosticHighlightCount: this.diagnosticHighlights.size,
      diagnosticHighlightsRendered: overlayRendered
        ? [...this.diagnosticHighlights].filter((highlight) =>
            highlight.isConnected
          ).length
        : 0,
      ownedRootCount: this.ownership.size,
      overlayRendered,
      panelRendered,
      ownsOverlay:
        this.overlay !== undefined &&
        this.isExtensionOwnedNode(this.overlay.container),
      ownsPanel:
        this.panel !== undefined &&
        this.isExtensionOwnedNode(this.panel.host),
    };
  }

  private isRendered(host: HTMLElement | undefined): boolean {
    return (
      host?.isConnected === true &&
      getComputedStyle(host).display !== "none"
    );
  }

  private mountPanel(): MountedPanel {
    const host = document.createElement("ui-torture-lab-root");
    host.dataset.uiTortureLabRoot = "";
    host.dataset.uiTortureLabRuntimeId = this.runtimeId;
    host.dataset.uiTortureLabSurface = "floating-panel";
    configureZeroFootprintHost(host, "2147483647");

    const shadow = host.attachShadow({ mode: "open" });
    isolateUiEvents(shadow);
    this.ownership.add(host, shadow);
    const style = document.createElement("style");
    style.textContent = panelCss;
    const container = document.createElement("div");
    shadow.append(style, container);
    document.documentElement.append(host);

    const root = createRoot(container);
    const render = (collapsed: boolean): void => {
      host.dataset.uiTortureLabCollapsed = String(collapsed);
      root.render(
        <ExtensionPanel
          collapsed={collapsed}
          onClearPreviousRunResult={() => this.clearPreviousRunResult()}
          onCollapse={() => render(true)}
          onExpand={() => render(false)}
          onInspectFinding={(finding, action) => this.inspectFinding(finding, action)}
          isFindingActionEnabled={(finding) => !this.invalidLiveFindings.has(finding)}
          onRestore={() => this.runController.restore()}
          onStartScenario={(scenarioId) => {
            void this.withMeasurementSafeUi(() =>
              this.runController.startScenario(scenarioId)
            );
          }}
          runController={this.runController}
          liveFindingMessage={this.liveFindingMessage}
          previousRunResult={this.previousRunResult}
        />,
      );
    };
    render(false);

    return {
      host,
      root,
      shadow,
      render,
      remove: () => {
        this.ownership.delete(host, shadow);
        root.unmount();
        host.remove();
      },
    };
  }

  private setLiveFindingMessage(message: string): void {
    this.liveFindingMessage = message;
    this.panel?.render(false);
  }

  private disableFindingActions(
    finding: ReturnType<RunController["getSnapshot"]>["findings"][number],
  ): void {
    this.invalidLiveFindings.add(finding);
    this.setLiveFindingMessage("Live Finding reference is no longer available.");
  }

  private selectDiagnosticLocator(locator: string): void {
    const locatorElement = [...(this.panel?.shadow.querySelectorAll<HTMLElement>(
      "[data-ui-torture-lab-diagnostic-locator]",
    ) ?? [])].find((element) => element.textContent === locator);
    if (locatorElement === undefined) return;

    const selection = this.document.getSelection();
    if (selection === null) return;
    const range = this.document.createRange();
    range.selectNodeContents(locatorElement);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private storeCurrentRunResult(
    result: NonNullable<ReturnType<RunController["getSnapshot"]>["result"]>,
  ): void {
    const location = this.document.defaultView?.location;
    if (location === undefined) return;
    void browser.runtime
      .sendMessage({
        page: pageMetadataFor(location),
        result,
        type: storeRunResultMessageType,
      })
      .catch(() => undefined);
  }

  private loadPreviousRunResult(): void {
    void browser.runtime
      .sendMessage({ type: readRunResultMessageType })
      .then((response) => {
        if (!isStoredRunResult(response)) return;
        this.previousRunResult = response;
        this.panel?.render(false);
      })
      .catch(() => undefined);
  }

  private clearPreviousRunResult(): void {
    this.previousRunResult = null;
    this.panel?.render(false);
    void browser.runtime
      .sendMessage({ type: clearRunResultMessageType })
      .catch(() => undefined);
  }

  private reportRunActivity(): void {
    const phase = this.runController.getSnapshot().phase;
    const active =
      phase === "applying-mutations" ||
      phase === "ready-for-inspection" ||
      phase === "restoring";
    if (!active && this.reportedRunActivity === null) return;
    if (this.reportedRunActivity === active) return;
    this.reportedRunActivity = active;
    void browser.runtime
      .sendMessage({ active, type: runActivityMessageType })
      .catch(() => undefined);
  }

  private clearRunActivity(): void {
    if (this.reportedRunActivity !== true) return;
    this.reportedRunActivity = false;
    void browser.runtime
      .sendMessage({ active: false, type: runActivityMessageType })
      .catch(() => undefined);
  }

  private ensureOverlay(): MountedOverlay {
    if (this.overlay?.host.isConnected) {
      return this.overlay;
    }

    this.overlay?.remove();
    const host = document.createElement("ui-torture-lab-overlay-root");
    host.dataset.uiTortureLabOverlayRoot = "";
    configureZeroFootprintHost(host, "2147483646");

    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = ":host{all:initial}*{box-sizing:border-box}";
    const container = document.createElement("div");
    shadow.append(style, container);
    document.documentElement.append(host);
    this.ownership.add(host, shadow);

    const mounted: MountedOverlay = {
      container,
      host,
      shadow,
      remove: () => {
        this.clearDiagnosticHighlights();
        this.ownership.delete(host, shadow);
        host.remove();
      },
    };
    this.overlay = mounted;
    return mounted;
  }
}

export function mountOrRevealDocumentRuntime(): void {
  const runtimeGlobal = globalThis as DocumentRuntimeGlobal;
  const existingRuntime = runtimeGlobal[runtimeKey];

  if (existingRuntime?.document === document) {
    existingRuntime.mountOrReveal();
    return;
  }

  const runtime = new DocumentRuntime();
  runtimeGlobal[runtimeKey] = runtime;
  runtime.mountOrReveal();
}
