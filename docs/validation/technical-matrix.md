# Pre-launch Technical Validation matrix

Recorded 2026-10-25 for issue #26. **Technical Validation remains pending:** the public main reconstruction and authorization correction pass locally; manual platform sign-off is incomplete. The captured Linux failure and the correction are recorded separately below. Strict CI on the correction must pass before merge. The static Pages site is deployed and its separate hosting evidence is in [the deployment record](../distribution/cloudflare-pages.md). Technical Validation remains pending; Product Validation now follows the owner-adopted [six-profile simulation](product/2026-10-26-simulated-review.md), without a human usability claim.

## Source and clean reconstruction

- Public repository: `https://github.com/marlenesco/ui-torture-lab` (visibility verified through GitHub).
- Baseline main: `4a208062a79872817a948aed3fa0a7b901523cab`, including [PR #47](https://github.com/marlenesco/ui-torture-lab/pull/47).
- A fresh HTTPS clone installed with `pnpm install --frozen-lockfile`, then ran `pnpm check`. Source remained clean after verification. This supersedes the earlier unpublished-candidate reconstruction.
- Environment: macOS 27.0.1 arm64, installed Google Chrome 155.0.8059.85, exact declared Node 24.13.1 and pnpm 11.20.0. This tests the Chrome floor; it does not establish manual acceptance of newer stable builds.
- **Passed:** lint, strict TypeScript/Astro checks, all production builds, 70 contract tests, 166 E2E tests (26.5 seconds), and artifact checks. E2E used four workers and zero retries.
- Authorization repetition: **60 tests passed** (12 tests × five repetitions, two workers, zero retries, 12.5 seconds). The Linux failure was not reproduced on this macOS/Chrome version.
- [Machine-readable baseline evidence](records/2026-10-25-main-4a20806.json) records pre-fix commands, environment, outcomes, synthetic measurements and artifact SHA-256 hashes; it intentionally retains the baseline failure state. Local `.scratch/issue26-*` logs supplement this record; no participant or third-party page data was collected.

## Contract matrix

| Area | Executed evidence | Clean macOS outcome |
| --- | --- | --- |
| All nine Scenario/Detector positive pairings and compatible negatives | scenario-detector-matrix; individual Engine and built-extension Run suites | Passed |
| Intentional ellipsis/line clamp, scrolling, unchanged pre-existing defects | Detector-specific positive/negative fixtures | Passed |
| Unstable/replaced/disconnected nodes; strict identity without rematching | Detector and live inspection suites | Passed |
| Restore conflicts, Unknown Mutation State, abort, unverified cleanup | mutation-journal, long-text-run, target-end-engine | Passed |
| Same-document navigation, same-URL entries, frame isolation, Page Exit, successful/unavailable BFCache | same-document-navigation, page-exit | Passed |
| UI loss/remount, ownership exclusions, diagnostic hiding, document geometry | target-page-authorization, distribution-lifecycle, ui-surface-comparison | Passed locally; see Linux regression/correction below |
| Worker suspension, lost heap state, port loss, runtime interruption, tab closure | distribution-lifecycle; sender/session contracts | Passed |
| Native explicit .md download, exact UTF-8 preview bytes, initiation-failure fallback, hidden-field omission and redaction | markdown-report browser/contracts, formatter goldens, distribution-lifecycle | Passed |
| Network and retention | Native page/worker Network observations; trusted session inspection and tab-close deletion | No Run requests observed; one reduced result per tab; cleanup passed |
| Manifest and public claims | Artifact/public-contract/static-site contracts | MV3; activeTab/scripting/storage only; minimum Chrome 155; Incognito disallowed; no persistent hosts |
| Website | Eight static routes; no-JavaScript navigation; keyboard/focus/responsive checks | Passed locally; public canonical origin verified under #25 |
| Supply chain and generated capabilities | Dependency/notices checks and adversarial artifact contracts | Passed; no capture API, remote code, page bridge, persistent storage or expanded permissions |
| Large/dynamic pages | Six runtime-bounds cases; fresh measurement below | Passed within the 8,000 ms fixture budget |

Static inspection is a regression guard, not a proof against arbitrary obfuscated code. Network observations cover the exercised workflows, not every future browser state. These outcomes do not validate a published Store artifact.

## Captured post-merge Linux failure

The [strict PR run](https://github.com/marlenesco/ui-torture-lab/actions/runs/40151923258) passed 70 contracts and 166 E2E tests without flakiness on Linux/Chrome 156.0.8078.47. The [subsequent main run](https://github.com/marlenesco/ui-torture-lab/actions/runs/40152953482), on the merged SHA with Node 24.13.1 and pnpm 11.20.0, **failed the strict stability gate**: 70 contracts passed; E2E reported 165 passed and one flaky test, `Document Runtime excludes owned UI and hides diagnostics during capture`.

Its screenshot-free `synthetic-failure-evidence` artifact confirms one delivered toolbar event with a URL present, two initial pure probes rejected with `Cannot access contents of the page`, and a subsequent successful cancellation call on that tab. The host never mounted in the failing attempt; the test passed on retry. This is compatible with a native grant-availability window, but does not establish whether Chrome or the simulated action is responsible. No unsafe Mutation, Restore, data exposure or permission expansion was observed in this failure.

### Authorization publication correction

The original adapter exhausted both initial access probes immediately. Both failures could arrive before native permission publication completed. The correction yields **100 ms once**, only after the first specific access-denial error, before the existing sole recheck. The target, expected URL and attempt token stay identical. The adapter checks that the attempt is still current before either probe; a newer action or closed tab cancels the delayed recheck. Permanent denial still fails closed after two probes, unrelated errors do not wait/retry, and no bootstrap, mounting or Mutation is replayed.

A virtual-clock regression failed before the correction because it observed two probes before permission publication. A built-extension regression also failed before the correction: one toolbar event, delayed native-access availability, no panel. Both now pass. Additional contracts cover supersession during the wait, tab closure, permanent denial, changed context and access denial after the first successful probe. The browser fixture injects only the native denial window; it does not grant broader access or fake a successful probe.

Local follow-up validation on the exact declared Node/pnpm passed **75 contracts, 167 E2E tests (26.2 seconds)**, lint, strict types, build and artifact checks. Five repetitions of the updated authorization file passed **65 tests**, two workers, zero retries (13.8 seconds). CI also runs these five repetitions with zero retries after the full strict suite. Test timeouts, global retry policy, permission budget and manual gates are unchanged. The current PR checks are the public Linux acceptance evidence; the historical main failure must not be relabeled as a successful run.

The first follow-up CI exposed a separate harness assumption in the small-viewport test: it read the host synchronously after native action dispatch, before asynchronous authorization/mounting completed. That test now waits for the host and rendered panel before measuring geometry, using the existing bounded readiness checks. Its geometry assertions are unchanged. The strict failure is retained as evidence rather than accepted through retry.

Native implementation context: Chromium updates the browser-side tab permission, completes a network permissions update, then notifies renderer processes. The browser action and scripting response are not an acknowledgement that every renderer has received the update. See [ActiveTabPermissionGranter](https://github.com/chromium/chromium/blob/main/extensions/browser/permissions/active_tab_permission_granter.cc) and [DevTools action dispatch](https://github.com/chromium/chromium/blob/main/chrome/browser/devtools/protocol/extensions_handler.cc). These sources explain the publication boundary; the controlled regression and actual strict Linux CI remain the behavioral evidence. The 100 ms window is bounded best-effort recovery, not a guarantee that Chrome will always grant access. A persistent denial remains visible and never authorizes a Run.

## Measurement policy and fresh benchmarks

The [Scenario/Detector policy](../../tests/benchmarks/scenario-detector-matrix.md) uses two frame samples before and after Mutation, a 0.5 CSS-pixel stability tolerance, and 1,000 ms frame bounds. [Viewport attribution](../../tests/benchmarks/viewport-overflow-geometry.md) adds only a 1 CSS-pixel rounding allowance and requires a stable direct contributor; magnitude does not rank different Detectors. Intensities remain fixed: [Long Text ×3](../../tests/benchmarks/long-text-expansion.md), [one 64-character Unbreakable Token](../../tests/benchmarks/unbreakable-token.md), [Large Text ×2](../../tests/benchmarks/large-text-scaling.md).

Fresh Run-plus-Restore measurements, 1280×900 viewport, two workers, zero retries:

| Scenario | 500-target flexible document | Dynamic boundary plus stable positive control |
| --- | ---: | ---: |
| Long Text | 214.0 ms | 193.1 ms |
| Unbreakable Text | 205.2 ms | 185.3 ms |
| Large Text | 212.3 ms | 213.5 ms |

Each large-page Run retained 500 eligible targets and produced no Finding; this does not mean every Detector-local comparison was conclusive. Each dynamic Run left the unstable boundary unattributed, produced the stable control Finding and restored successfully. All six were below 8,000 ms. These are synthetic fixture budgets, not deadlines for arbitrary pages.

The fresh full suite asserted exact before/after equality for floating UI viewport/client width, document/body scroll width, breakpoint and resize count: zero measured change in those controlled observables. The fresh rejected Side Panel benchmark passed the opposite assertions: reduced layout/client/scroll widths, wide-to-narrow breakpoint transition, unchanged outer width and resize events. The historical 900→514 px result in [UI surface comparison](../../tests/benchmarks/ui-surface-comparison.md) is not presented as a new numeric observation. The seven-case focused benchmark run passed without retries or flaky tests.

## Merged correction

[PR #48](https://github.com/marlenesco/ui-torture-lab/pull/48) merged as `4ed925d7b99dc96b95691638754348f2081265b2`. [Strict main CI](https://github.com/marlenesco/ui-torture-lab/actions/runs/40213504538) passed 75 contracts, 167 E2E and 65 zero-retry authorization checks. This was the corrected historical candidate; the smoke checklist now pins protected main `7b579c0` (version 1.0.0, PR #51). Pre-fix records remain historical. Standards review found zero issues; Spec review found one non-blocking candidate-SHA documentation follow-up, addressed by that pin. See [the review](pr48-review.md).

## Remaining manual validation

Use [the platform checklist and blank sign-off record](manual-platform-smoke.md) on the exact candidate, in normal current Chrome stable, with actual toolbar interaction. Automated drivers do not constitute manual sign-off.

| Platform | Available automated evidence | Manual state |
| --- | --- | --- |
| macOS | Clean public checkout passed on Chrome 155.0.8059.85 | Pending on current stable; record operator/version/artifact and checklist outcomes |
| Windows | No Windows host or run operated in this task | Explicit unresolved platform blocker; complete the same checklist on Windows |
| Linux | Public Chrome 156 baseline plus the current correction PR checks | Pending; actual-toolbar smoke must distinguish native action from test-driver behavior |

Known limits: top-level HTTP(S) light-DOM HTML only; no iframe/Shadow traversal, other browsers, mobile, Incognito or private-router observation guarantee. Unobservable SPA transitions require Restore first. Page Exit cleanup depends on event delivery; abrupt termination can prevent cleanup. Inconclusive Evidence never becomes a Finding. The Chrome floor is 155; Linux Chrome 156 behavior cannot be inferred from macOS/155.

Unsafe Restore, false attribution, undeclared retention, unexpected extension requests, hidden export data and artifact divergence remain non-waivable blockers. None was observed by the passing checks; strict CI on the merged correction passed and manual unknowns remain open. `launch-gates.json.technicalValidation` stays `pending`; **#26 must remain open**.

Cloudflare deployment/preview/rollback evidence is recorded under #25. The owner replaced the human-participant launch criterion in #28 with [six explicitly simulated professional-role reviews](product/2026-10-26-simulated-review.md); human usability remains unverified. Official Distribution (#29) remains pending. Main protection was enabled and [read back on 2026-10-26](records/2026-10-26-main-protection.json). Canonical Store identity, final tag and release-record validation remain prerequisites. The Pages GitHub App was explicitly authorized for only this repository. No tags, Store submission or release publication were performed.

The 2026-10-25 macOS session reported disconnected and overlapping control panels. [Runtime generation recovery](runtime-generation-recovery.md) records the synthetic reproduction, conservative admission correction, and manual retest requirement. This report does not complete a platform sign-off.

## 2026-10-26 manual highlight follow-up

The operator's current macOS session identified invisible or misplaced diagnostic
highlights and a rectangle remaining after Restore. The actual target was the
public Pages preview, so those reports are not controlled-fixture passes.
[Inspection highlight recovery](inspection-highlight-recovery.md) records the
independent native reproduction, correction and automated regressions. Resume
manual validation on the corrected artifact with recorded source and hashes;
previous draft ZIPs are superseded. Issue #26 and the technical gate remain open.
