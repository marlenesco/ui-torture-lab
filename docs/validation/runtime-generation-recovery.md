# Runtime generation recovery — issue #26

A macOS manual session on 2026-10-25 reported a disconnected control panel followed by overlapping panels. The user confirmed an extension reload in `chrome://extensions` as the trigger and clarified that the test page was the public Official Website. Initial human-only reports did not establish a consistent target tab; they are not verified fixture evidence. Private screenshots are not published here.

## Reproduction and cause

`tests/e2e/runtime-generation.spec.ts` creates a fresh native Chrome ISOLATED context by uninstalling one unpacked extension and installing the same artifact from a temporary copied path with a distinct extension ID. The old control DOM remains in the same Document. This reproduces the ownership boundary and duplicate UI symptom; it does not claim to automate Chrome's extension-manager reload or prove the user's exact trigger.

Before the correction, the fresh context mounted a second overlay (expected 1, received 2). The previous runtime's in-memory ownership registry was unavailable in the fresh context, but bootstrap did not check for surviving control surfaces. A disconnected runtime also continued to offer new Scenarios without a confirmed transport.

## Recovery contract

- Bootstrap refuses existing control surfaces unless the current ISOLATED runtime proves their direct node ownership in the same Document. It returns `unverified-control-surface` and tells the operator to reload the page.
- DOM names and attributes only identify candidates for refusal. They never prove ownership, authorize removal, or adopt a previous Mutation Journal. A page that spoofs these markers can prevent authorization on itself; its nodes are preserved.
- A true top-level reload clears the orphan Document. Another explicit toolbar action can then authorize the new Target Page and mount one panel and overlay.
- New Scenarios wait for the current port's matching grant acknowledgement. A stale acknowledgement does not enable them. Transport loss disables new Scenarios while preserving local Restore for an existing Run. A toolbar action can reconnect controls owned by the current runtime.
- No automatic reconnection, page reload, grant renewal, MAIN-world bridge, extra permission, or persistent ownership state is introduced. Abrupt runtime destruction can still prevent cleanup; reload may be necessary to clear unverified Mutations.

## Automated and manual evidence

Contract tests cover absent, incomplete, foreign-Document and mixed ownership, genuine current-runtime ownership, exact attempt/listener cleanup, and rejection feedback before runtime injection. Native browser tests cover orphan refusal, true reload recovery, Run/Restore, delayed and stale acknowledgements, and worker suspension with local Restore and explicit reconnection.

Local validation passed with Node 24.13.1 and pnpm 11.20.0: `pnpm check` completed lint, typecheck, builds, 81 contract tests, 174 E2E tests and artifact checks. No E2E retry was used. Linux CI evidence belongs to the correction PR.

An assisted native-browser retest used the same `https://ui-torture-lab.pages.dev/` tab before and after a human-operated extension reload. Direct DOM inspection confirmed one panel, one overlay, a connection-loss message and three disabled Apply buttons. The real toolbar action preserved those counts and requested a page reload. A true page reload and explicit authorization then permitted Long Text and Restore; the restored page body text exactly matched its pre-Run value. The correction PR records this bounded observation separately from the distinct-ID automated reproduction.

## Panel presentation

The panel retains one compact graphite surface and one lime action accent. Scenario choices use aligned full-width rows; Findings and the Markdown preview use spacing and dividers without hiding Evidence or adding new controls. Actions use a leading SVG on a small lime backplate, with its strokes matching the panel background to give a cutout appearance. Text sits to its right on a transparent, borderless native button; the complete row remains clickable. Disabled buttons use muted readable text, muted icon backplates and a `not-allowed` cursor, with no enabled hover treatment. The native disabled attribute remains the activation guard.

Inline SVGs precede action labels inside native buttons; they are hidden from assistive technology and cannot take focus. Clicking a glyph triggers the same button action. The header offers separate Collapse and Close controls with accessible names and tooltips. Collapse keeps the compact launcher; Close removes the panel, overlay and highlights, with no remaining interactive control. It preserves Active Run State and Restore until the next explicit toolbar action, while normal navigation and Page Exit invalidation still apply.

A closed panel retains one `display:none`, non-interactive runtime marker owned through its direct node reference. This is not visible UI or durable storage: it lets bootstrap refuse a fresh extension context after reload even when the closed Run's Mutation Journal is no longer reachable. DOM markers still cannot prove ownership. Reopening from the same runtime removes the marker before mounting one panel and overlay; asynchronous grant acknowledgements do not reopen a closed panel.

Text-color transitions do not animate geometry, and reduced-motion preferences disable transitions. Native browser coverage compares enabled and disabled computed styles, verifies reduced motion and visible keyboard focus, and exercises the existing narrow-viewport and measurement-contamination checks. Screenshots use original synthetic fixtures only.

These checks do not replace the real-toolbar macOS, Windows and Linux checklist in [manual-platform-smoke.md](manual-platform-smoke.md). The assisted reload/recovery check is a partial result; all complete platform sign-offs and `technicalValidation` remain pending.
