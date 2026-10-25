# Runtime generation recovery — issue #26

A macOS manual session on 2026-10-25 reported a disconnected control panel followed by overlapping panels after a reload action. The exact reload action is not confirmed. This blocks the manual sign-off; screenshots from the session are private and are not published here.

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

Local validation passed with Node 24.13.1 and pnpm 11.20.0: `pnpm check` completed lint, typecheck, builds, 81 contract tests, 169 E2E tests and artifact checks. No E2E retry was used. Linux CI evidence belongs to the correction PR.

These checks do not replace the real-toolbar macOS, Windows and Linux checklist in [manual-platform-smoke.md](manual-platform-smoke.md). All platform sign-offs and `technicalValidation` remain pending. Repeat the reported reload sequence with the corrected artifact, record exactly which UI action was used, and verify one panel, one overlay, explicit authorization and working Restore before clearing this blocker.
