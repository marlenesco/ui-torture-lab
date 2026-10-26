// SPDX-License-Identifier: Apache-2.0

type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
type Kind = "subject" | "range";

/** Owns temporary inspection geometry and releases live readers with its listeners. */
export class DiagnosticHighlights {
  private readonly elements = new Set<HTMLElement>();
  private stopFollowing: (() => void) | null = null;

  constructor(private readonly document: Document, private readonly container: () => HTMLElement) {}

  get size(): number { return this.elements.size; }
  get connectedCount(): number { return [...this.elements].filter(element => element.isConnected).length; }

  show(rect: Rect, kind: Kind = "subject"): void {
    const highlight = this.document.createElement("div");
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
    this.container().append(highlight);
    this.elements.add(highlight);
  }

  follow(kind: Kind, read: () => readonly Rect[] | null): boolean {
    this.clear();
    const paint = (): boolean => {
      let rectangles;
      try { rectangles = read(); } catch { this.clear(); return false; }
      if (rectangles === null || rectangles.length === 0) { this.clear(); return false; }
      this.removeElements();
      for (const rectangle of rectangles) this.show(rectangle, kind);
      return true;
    };
    if (!paint()) return false;
    const view = this.document.defaultView;
    if (view === null) return true;
    let frame: number | null = null;
    const schedule = (): void => {
      if (frame !== null) return;
      frame = view.requestAnimationFrame(() => { frame = null; paint(); });
    };
    view.addEventListener("scroll", schedule, { capture: true, passive: true });
    view.addEventListener("resize", schedule, { passive: true });
    this.stopFollowing = () => {
      view.removeEventListener("scroll", schedule, true);
      view.removeEventListener("resize", schedule);
      if (frame !== null) view.cancelAnimationFrame(frame);
    };
    return true;
  }

  clear(): void {
    this.stopFollowing?.();
    this.stopFollowing = null;
    this.removeElements();
  }

  private removeElements(): void {
    for (const element of this.elements) element.remove();
    this.elements.clear();
  }
}
