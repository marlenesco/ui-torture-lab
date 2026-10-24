// SPDX-License-Identifier: Apache-2.0

import { createRoot, type Root } from "react-dom/client";
import { createRunController, type MarkdownReportInput, type TargetEndReason, type RunController } from "@ui-torture-lab/engine";
import { browser, type Browser } from "wxt/browser";
import { ExtensionPanel } from "./panel";
import { panelCss } from "./panel-style";
import {
  isStoredRunResult,
  pageMetadataFor,
} from "../target-page/current-run-result";
import { observeSameDocumentNavigation } from "../target-page/navigation";
import {
  bindGrantMessageType,
  runtimePortName,
  unreachableMessageType,
  invalidateGrantMessageType,
  clearRunResultMessageType,
  readRunResultMessageType,
  runActivityMessageType,
  storeRunResultMessageType,
  storePreviousRunResultMessageType,
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
  runController: RunController;
  private readonly ownership = new ExtensionDomOwnership();
  private readonly diagnosticHighlights = new Set<HTMLElement>();
  private readonly invalidLiveFindings = new Set<
    ReturnType<RunController["getSnapshot"]>["findings"][number]
  >();
  private storedResult: ReturnType<RunController["getSnapshot"]>["result"] = null;
  private currentRunReport: MarkdownReportInput | null = null;
  private previousRunResult: MarkdownReportInput | null = null;
  private grantId: string | null = null;
  private authorized = false;
  private targetEnded = false;
  private ending = false;
  private page = pageMetadataFor(window.location);
  private unsubscribeEngine: () => void = () => undefined;
  private reachabilityPort: Browser.runtime.Port | null = null;
  private navigationObserver: ReturnType<typeof observeSameDocumentNavigation>;
  private reportedRunActivity: boolean | null = null;
  private liveFindingMessage: string | null = null;
  private overlay: MountedOverlay | undefined;
  private panel: MountedPanel | undefined;

  constructor() {
    this.runController = this.createController();
    this.navigationObserver = observeSameDocumentNavigation(window, () => this.endTarget("same-document-navigation"));
    this.document.defaultView?.addEventListener("pagehide", () => this.endTarget("page-exit"));
    this.document.defaultView?.addEventListener("pageshow", (event) => {
      if (!event.persisted) return;
      this.endTarget("page-exit");
      this.panel?.render(false);
    });
  }

  private createController(): RunController {
    const controller = createRunController({
      document: this.document,
      isExtensionOwnedNode: (node) => this.isExtensionOwnedNode(node),
    });
    this.unsubscribeEngine = controller.subscribe(() => {
      const snapshot = controller.getSnapshot();
      if (snapshot.phase !== "ready-for-inspection") {
        this.invalidLiveFindings.clear();
      }
      if (!this.ending && this.authorized && snapshot.result !== null && snapshot.result !== this.storedResult) {
        this.storedResult = snapshot.result;
        this.storeCurrentRunResult(snapshot.result);
        this.panel?.render(this.panel.host.dataset.uiTortureLabCollapsed === "true");
      }
      this.reportRunActivity();
    });
    return controller;
  }

  async authorize(grantId: string): Promise<"mounted" | "reload-required" | "failed"> {
    this.grantId = grantId;
    if (this.targetEnded && this.previousRunResult !== null) {
      const saved = await browser.runtime.sendMessage({ type: storePreviousRunResultMessageType, grantId, page: this.previousRunResult.page, result: this.previousRunResult.result }).catch(() => false);
      if (saved !== true || this.grantId !== grantId) return "failed";
    }
    if (this.runController.getSnapshot().phase === "reload-required") {
      this.mountOrReveal();
      return "reload-required";
    }
    if (this.targetEnded) {
      this.unsubscribeEngine();
      this.runController = this.createController();
      this.storedResult = null;
      this.currentRunReport = null;
      this.reportedRunActivity = null;
      this.navigationObserver = observeSameDocumentNavigation(window, () => this.endTarget("same-document-navigation"));
    }
    if (!this.authorized) this.page = pageMetadataFor(window.location);
    this.grantId = grantId;
    this.authorized = true;
    this.targetEnded = false;
    this.liveFindingMessage = null;
    this.openReachability();
    this.mountOrReveal();
    return "mounted";
  }

  private endTarget(reason: TargetEndReason): void {
    this.navigationObserver.stop();
    if (this.targetEnded) return;
    this.targetEnded = true;
    this.authorized = false;
    this.ending = true;
    const result = this.runController.endTarget(reason);
    this.ending = false;
    this.storedResult = result;
    if (result !== null) this.previousRunResult = { page: this.page, result, state: "previous" };
    this.currentRunReport = null;
    this.clearDiagnosticHighlights();
    this.invalidLiveFindings.clear();
    this.liveFindingMessage = "Target Page authorization ended. Click the toolbar action again after verified Restore.";
    this.reportedRunActivity = false;
    const port = this.reachabilityPort;
    this.reachabilityPort = null;
    try { port?.disconnect(); } catch { /* The local cleanup is already complete. */ }
    if (reason !== "page-exit") this.panel?.render(this.panel.host.dataset.uiTortureLabCollapsed === "true");
    if (this.grantId !== null) this.notifyRuntime({ type: invalidateGrantMessageType, grantId: this.grantId, page: this.page, result });
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
    if (!this.authorized) return;
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
          authorized={this.authorized}
          navigationComplete={this.navigationObserver.complete}
          currentRunReport={this.currentRunReport}
          onClearPreviousRunResult={() => this.clearPreviousRunResult()}
          onCollapse={() => render(true)}
          onExpand={() => render(false)}
          onInspectFinding={(finding, action) => this.inspectFinding(finding, action)}
          isFindingActionEnabled={(finding) => !this.invalidLiveFindings.has(finding)}
          onRestore={() => { if (this.authorized) this.runController.restore(); }}
          onStartScenario={(scenarioId) => {
            if (!this.authorized) return;
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
    if (!this.authorized || this.grantId === null) return;
    const page = this.page;
    this.currentRunReport = { page, result, state: "current" };
    this.notifyRuntime({ page, result, type: storeRunResultMessageType, grantId: this.grantId });
  }

  private loadPreviousRunResult(): void {
    if (this.grantId === null) return;
    const grantId = this.grantId;
    void browser.runtime
      .sendMessage({ type: readRunResultMessageType, grantId })
      .then((response) => {
        if (!this.authorized || this.grantId !== grantId || !isStoredRunResult(response)) return;
        this.previousRunResult = response;
        this.panel?.render(false);
      })
      .catch(() => undefined);
  }

  private clearPreviousRunResult(): void {
    this.previousRunResult = null;
    this.panel?.render(false);
    this.notifyRuntime({ type: clearRunResultMessageType, grantId: this.grantId });
  }

  private reportRunActivity(): void {
    if (!this.authorized || this.grantId === null || this.ending) return;
    const phase = this.runController.getSnapshot().phase;
    const active =
      phase === "applying-mutations" ||
      phase === "ready-for-inspection" ||
      phase === "restoring";
    if (!active && this.reportedRunActivity === null) return;
    if (this.reportedRunActivity === active) return;
    this.reportedRunActivity = active;
    this.notifyRuntime({ active, type: runActivityMessageType, grantId: this.grantId });
  }

  private notifyRuntime(message: unknown): void {
    try { void browser.runtime.sendMessage(message).catch(() => undefined); }
    catch { /* An interrupted extension runtime cannot be required for local Restore. */ }
  }

  private openReachability(): void {
    const old = this.reachabilityPort;
    this.reachabilityPort = null;
    try { old?.disconnect(); } catch { /* The previous transport may already be gone. */ }
    if (this.grantId === null) return;
    const grantId = this.grantId;
    try {
      const port = browser.runtime.connect({ name: runtimePortName });
      this.reachabilityPort = port;
      port.onMessage.addListener((message) => {
        if (message?.type !== "grant-bound" || message.grantId !== grantId || this.reachabilityPort !== port) return;
        this.reportedRunActivity = null;
        this.reportRunActivity();
      });
      port.onDisconnect.addListener(() => {
        if (this.reachabilityPort !== port) return;
        this.reachabilityPort = null;
        this.reportedRunActivity = false;
        this.notifyRuntime({ type: unreachableMessageType, grantId });
        if (!this.targetEnded) {
          this.liveFindingMessage = "Extension connection lost. Restore remains available; reopen the toolbar to reconnect.";
          this.panel?.render(this.panel.host.dataset.uiTortureLabCollapsed === "true");
        }
      });
      const phase = this.runController.getSnapshot().phase;
      port.postMessage({ type: bindGrantMessageType, grantId, active: phase === "applying-mutations" || phase === "ready-for-inspection" || phase === "restoring" });
    } catch {
      this.notifyRuntime({ type: unreachableMessageType, grantId });
    }
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

export function prepareDocumentRuntime(): void {
  const runtimeGlobal = globalThis as DocumentRuntimeGlobal;
  const existingRuntime = runtimeGlobal[runtimeKey];

  if (existingRuntime?.document === document) {
    return;
  }

  const runtime = new DocumentRuntime();
  runtimeGlobal[runtimeKey] = runtime;
}
