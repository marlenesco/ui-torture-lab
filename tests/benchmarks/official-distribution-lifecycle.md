# Official Distribution lifecycle validation

The release gate uses the generated `apps/extension/.output/chrome-mv3` artifact in installed Google Chrome stable, with deterministic local HTTP/HTTPS fixtures. Focused Engine tests remain complementary; they are not substitutes for the public workflow tests.

## Coverage map

| Contract | Executable evidence |
| --- | --- |
| Toolbar → each Scenario → all three Detectors → inspection → Restore → Current Run Result → native Copy Markdown | `distribution-lifecycle.spec.ts` |
| UI collapse, Shadow host loss, remount without reapplying Mutation, unchanged geometry | `distribution-lifecycle.spec.ts`, `target-page-authorization.spec.ts` |
| UI/highlight exclusion from acquisition and comparison against rejected Side Panel | `target-page-authorization.spec.ts`, `ui-surface-comparison.spec.ts`, `ui-surface-comparison.md` |
| Native service-worker stop and restart, port loss without automatic Restore | `distribution-lifecycle.spec.ts`, `page-exit.spec.ts` |
| Extension removal/runtime interruption; local cleanup remains independent of transport | `distribution-lifecycle.spec.ts`, `page-exit.spec.ts` |
| Reload, same-document entries, Page Exit, actual successful and unavailable BFCache, canceled frames | `same-document-navigation.spec.ts`, `page-exit.spec.ts`, `target-end-engine.spec.ts` |
| Unknown Mutation State, abort, conflict, unverified Restore, no unsafe continuation | `mutation-journal.spec.ts`, `long-text-run.spec.ts`, `markdown-report.spec.ts` |
| Non-live snapshot, deterministic report, explicit clipboard gesture, denial fallback | `markdown-report.spec.ts`, `markdown-report.test.mjs` |
| Exact permissions, Incognito exclusion, no persistent matches, no MAIN-world bridges | `scaffold-artifacts.test.mjs`, `target-page-authorization.test.mjs`, `distribution-lifecycle.spec.ts` |
| Unsupported protocol, protected surface, main-frame-only ISOLATED execution | `target-page-authorization.spec.ts`, `target-page-authorization.test.mjs`, `scaffold-artifacts.test.mjs` |
| Page and worker network observation; no requests during Run, UI remount, Restore, or Copy | `distribution-lifecycle.spec.ts` |
| One reduced result per tab, no query/fragment/form-value/full paragraph retention, deletion on tab close | `distribution-lifecycle.spec.ts`, `target-page-authorization.test.mjs` |

The public matrix retains all three Detector groups for each Scenario, restores exact synthetic markup, checks viewport/document extent before and after UI transitions, and verifies that the Markdown preview remains identical after native Copy. Short, redacted previews are permitted; the test rejects retention of a full long paragraph and hidden form values.

## Failure evidence and bounds

Playwright assertions identify the lifecycle boundary and show expected/actual state. Failure traces retain synthetic DOM and source context with screenshot capture explicitly disabled. The installed-extension matrix additionally checks uncaught page errors and records unexpected page/worker request URLs. No real page, authenticated URL, personal data, screenshot, history export, or report upload is part of this suite.

The service worker is stopped through Chrome DevTools Protocol; this exercises lost volatile background state rather than clearing storage or invoking private application helpers. Native extension removal tests runtime interruption, not guaranteed recovery after abrupt renderer or browser termination. BFCache outcomes are asserted explicitly, never inferred from a port disconnect.

Run the pre-merge gate with:

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm test:contracts
pnpm test:e2e --workers=4
```

Runtime and platform limits remain those in the [navigation](same-document-navigation.md) and [Page Exit](page-exit-bfcache.md) benchmarks. Cross-platform manual validation and release publication are separate launch gates.

Milestone validation on Chrome 155.0.8059.85/macOS: lint, strict type checking, production build, 38 contract tests, and 141 E2E tests passed. The public workflow exposed an empty `style` attribute left by Large Text Restore; Restore now removes only that introduced empty attribute, preserving pre-existing attributes and external style properties.

Hosted CI records its actual Node/pnpm/Chrome/resource versions, uses two workers, and treats flaky tests as failures even when a retry passes. Local validation defaults to four workers. Clipboard probes use the bounded ISOLATED request/collect helper, and the grouped Text Clipping workflow uses public panel controls. Named clipboard/click steps improve timeout diagnostics.

Extension-host readiness waits use a shared five-second native DOM poll instead of Puppeteer's utility-world mutation selector wait. The strict Linux run isolated timeouts at that selector barrier; the new helper observes the same required host directly, matching the existing Markdown-preview readiness strategy. No application timeout, retry budget, or supported capability is widened.
