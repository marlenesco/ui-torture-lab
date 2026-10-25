# Pre-launch Technical Validation matrix

Status: automated macOS candidate validation passed; launch approval remains blocked. This record does not claim Product Validation, a published clean-checkout validation, manual platform smoke completion, deployment, or an Official Distribution.

## Candidate and environment

- Source baseline: public main `3a134c7a0b127a0bfec1776bd1f014823419f41a`, with local issue #19–#24 candidate commits through `b9ed115` and the additional runtime-bounds fixtures in this change.
- Executed environment: Node 24.22.1, pnpm 11.20.0, Google Chrome desktop stable 155.0.8059.85 on macOS. Node satisfies the workspace range but differs from the exact `.node-version` release environment (24.13.1).
- Manifest: MV3, minimum Chrome 155, Incognito not_allowed, activeTab/scripting/storage only, no persistent host access.
- Website: eight static HTML routes with local CSS and no required JavaScript. Local canonicals are intentional until a real official SITE_URL is configured.

## Contract matrix

| Area | Automated evidence | Candidate outcome |
| --- | --- | --- |
| Every Scenario/Detector positive pairing and compatible negatives | scenario-detector-matrix, individual Engine and built-extension Run suites | Passed |
| Intentional ellipsis/line clamp, scrolling, pre-existing unchanged defects | detector-specific positive/negative fixtures | Passed |
| Unstable/replaced/disconnected nodes, strict identity, no rematching | detector and live inspection suites | Passed |
| Restore conflicts, Unknown Mutation State, abort, unverified cleanup | mutation-journal, long-text-run, target-end-engine | Passed |
| Navigation, same-URL state, frame isolation, Page Exit, real and unavailable BFCache | same-document-navigation, page-exit | Passed |
| UI loss, remount, highlights, layout viewport/document extent | target-page-authorization, distribution-lifecycle, UI-surface comparison | Passed |
| Worker suspension, port loss, runtime removal, tab closure | distribution-lifecycle and sender/session contracts | Passed |
| Permission, trusted session lifetime, redaction, explicit native Markdown Copy | artifact, sender-validation, formatter, Markdown, distribution-lifecycle | Passed |
| No extension Run network request | native page and worker Network observations during public workflows | Passed |
| Static HTML, keyboard/focus, no-JS navigation, responsive/reduced motion | static-site contracts and browser smoke | Passed |
| Artifact capabilities, supply chain, attribution, source/provenance tripwires | check:artifacts and adversarial policy contracts | Passed |
| 500-node flexible page and continuous layout instability | runtime-bounds six-case benchmark | Passed |

The prior complete candidate gate passed 52 contract tests and 145 E2E tests; the six additional runtime-bounds tests passed separately. Lint, strict types, production build, and read-only artifact checks passed. A clean candidate reconstruction and final combined suite are recorded separately when executed; these numbers are not a claim about an unexecuted public CI run.

## Measurement policy and known limits

Use [scenario-detector-matrix](../../tests/benchmarks/scenario-detector-matrix.md) for the two-sample before/after windows, 0.5 CSS-pixel stability tolerance, and 1,000 ms frame bounds. The [viewport benchmark](../../tests/benchmarks/viewport-overflow-geometry.md) permits only a 1 CSS-pixel extent-attribution rounding allowance and requires a stable direct contributor. Long Text repeats three times, Unbreakable Text appends the single 64-character token, and Large Text scales stable baseline font sizes by two; each has a dedicated intensity benchmark.

The rejected Side Panel consumed layout width, while the selected floating Shadow UI preserved the controlled geometry; see [UI surface comparison](../../tests/benchmarks/ui-surface-comparison.md). That original spike's recorded Chrome version is historical; current candidate regressions pass on 155. An unchanged historic number is not presented as a fresh manual observation.

Private router transitions without an observable entry change are outside the navigation guarantee. When Navigation entries are unavailable the UI requires Restore before SPA route changes. Page Exit cleanup is synchronous for delivered events, while abrupt runtime termination can prevent cleanup or final result delivery. The technical Chrome floor is the tested 155 candidate; older versions, other browsers, mobile, iframe/Shadow traversal, and application behavior remain unsupported. Dynamic/unsupported comparisons are inconclusive, never attributed as Findings. Large-document timing is an empirical fixture budget, not a universal performance guarantee.

## Unresolved platform and source gates

| Gate | Actual state | Required evidence |
| --- | --- | --- |
| Clean published source checkout and exact release Node | Not yet run on a published candidate commit | Publish/review the candidate, reconstruct at its public SHA using the declared versions, and preserve complete gate output |
| macOS manual Chrome stable smoke | Automated tests passed; no independent manual sign-off | Complete the checklist below and record operator, Chrome version, candidate SHA, and outcome |
| Windows manual Chrome stable smoke | Unresolved platform blocker: no Windows host operated in this task | Same checklist on Windows; do not infer success from macOS |
| Linux manual Chrome stable smoke | Unresolved platform blocker: no Linux host operated in this task | Same checklist on Linux; future CI is complementary and does not fabricate manual sign-off |
| Cloudflare deployment/rollback | Account selection and live deployment unresolved (#25) | Verified public routes, settings, preview and rollback record |
| Formative study | No participants observed (#28) | Six to eight independent qualifying developers and a redacted launch decision |

`launch-gates.json.technicalValidation` remains pending. No unsafe Restore, false attribution, data exposure, unexpected extension network use, hidden export, or public-contract divergence may be waived to proceed.

## Manual smoke checklist

Use the exact candidate artifact on current Chrome desktop stable in a normal context. Record only synthetic outcomes and environment identifiers.

1. Install/load the candidate and verify its version and three permissions; Incognito access is unavailable.
2. On a local HTTP fixture, explicitly authorize by toolbar, run each Scenario, inspect representative Findings from all three Detectors, and Restore.
3. Collapse/remove/reopen the UI during an active Run; mutation and Evidence remain consistent and Restore stays available. Check a small viewport, keyboard controls, and page geometry.
4. Compare the visible Markdown preview with Copy; retry with clipboard denial and manual selection. Confirm no query/fragment or form values appear. Never paste private reports into project systems.
5. Trigger a conflict and verify reload-required preserves external changes and blocks another Run. A true reload permits a fresh toolbar grant.
6. Exercise same-document navigation, reload, back/forward, Page Exit, BFCache where available, port loss, tab close, and extension interruption. Record actual cache outcomes; never infer them from disconnect alone.
7. Inspect extension network/session state: no application request or screenshot, one reduced result per tab, no durable history, deletion after tab close. Distinguish the target page's own requests.
8. Open all eight site routes from an ordinary static server with JavaScript disabled; check keyboard focus, responsive layout, canonical paths, and installation status.

Any failure records a blocker with a synthetic reproduction, affected gate, owner, and retest requirement. Leave unknowns unresolved until observed.

## Clean local candidate reconstruction

On 2026-10-25, an isolated clean local clone at candidate commit `aa9d49b958790c1f9b419a3567cec991019c02d2` installed dependencies with `pnpm install --offline --frozen-lockfile` and passed the complete `pnpm check` command. The source tree remained clean after verification. This candidate is not yet a published protected main commit.

Results: lint passed; strict TypeScript/Astro checks reported zero errors, warnings, or hints; all three production workspaces built; 52 contract tests and 160 E2E tests passed; the release artifact gate passed. E2E used four workers and completed in 25.5 seconds on this machine. Environment: Node 24.22.1, pnpm 11.20.0, Chrome 155.0.8059.85/macOS. No retry or timeout increase was used to obtain this result.

The temporary checkout and its processes were removed after verification. Local command logs remain under `.scratch/clean-install.log` and `.scratch/clean-check.log`; those logs are not public release evidence or participant data. Manual platform sign-off, the exact release Node reconstruction on a published candidate, Cloudflare deployment/rollback, Product Validation, and release publication remain unresolved. Technical Validation is therefore still pending as a launch gate.
