# Formative Product Validation kit

Status: no human recruitment, participant session or observed human outcome has been completed. On 2026-10-26 the owner adopted six professional-role AI reviews as the 1.0.0 launch criterion for issue #28; see [ADR-0032](../../adr/0032-adopt-explicitly-simulated-product-validation-for-launch.md). The human study kit from issue #27 remains available for a future optional study. Neither fixture tests nor AI reviews are observed human usability evidence.

## Current launch method

The six simulated perspectives are frontend engineering, QA/lifecycle, privacy and trust, UX/content, keyboard/accessibility of the Extension UI, and release/integration engineering. Each review must identify its materials and assisted method, record task observations, separate confirmed blockers from optional improvements and give a scoped pass/iterate/blocked recommendation. Reviewers must not fabricate browser execution, human task completion, participant-owned interfaces, quotes or OS sign-offs. The aggregate decision requires all six reports and no unresolved confirmed blocker; Technical Validation remains a separate gate. Review results and the final decision are recorded in the dated simulated-review report in this directory.

The protocol below concerns **optional future human research**. Its recruitment counts and uncoached success thresholds no longer determine the 1.0.0 launch gate.

## Objective and recruitment

Observe six to eight independent frontend developers who work with HTML, CSS, interface implementation, and Chrome DevTools. Exclude maintainers, contributors, people who designed or implemented the product, and anyone already coached on its workflow from the primary participant count. Record coarse experience bands and relevant tool familiarity, not employer, name, email, or personal identifiers in research notes. Recruitment contact details and consent, if needed, stay with the organizer outside the repository.

Seek a mix of experience and interface work; do not recruit only people with unusually similar workflows. Each participant should have an optional interface they own, can modify, and are authorized to inspect over localhost, staging, intranet, or public HTTP(S). Never request project access, credentials, source, a private URL, or deployment changes.

Suggested invitation (send only with explicit organizer authorization):

> We are studying a pre-release text stress tool for frontend developers. In a roughly 35–45 minute session, try it on synthetic interfaces and optionally an interface you own and may inspect. We study the tool, not your skill. Thinking aloud is helpful. No recording, telemetry, page/report collection, account, or payment is required by the tool. You may skip a task or stop at any time.

## Setup and materials

1. Read the [privacy protocol](privacy-protocol.md), [facilitator script](facilitator-script.md), and [observation template](observation-template.md).
2. Finish Technical Validation for the exact candidate before involving participants. Unsafe Restore, data exposure, unexpected extension network requests, false attribution, hidden export, misleading lifecycle status, or a public-contract divergence blocks the study and release.
3. Record the candidate SHA, extension/Chrome versions, platform, and synthetic fixture version once per study. Use Chrome desktop stable in a normal context at 1280×900, browser zoom 100%, with the same viewport throughout a Run. Install the candidate in advance; do not coach the product workflow during setup.
4. Build from the workspace root and run `pnpm dev:fixtures`. The neutral controlled routes are `http://127.0.0.1:4173/product-validation/a/`, `/product-validation/b/`, and `/product-validation/c/`. Stop the fixture server after the session.
5. Use the exact general-goal prompt in the script. Counterbalance controlled fixture order across participants (ABC, BCA, CAB) and record order. Do not reveal the facilitator key or prescribe a Scenario.
6. Offer the participant-owned phase with no access or content collection by the project. If sensitive content would be visible, permit local-only use with verbal reflection, or skip the phase.

## Facilitator-only controlled key

- A: a trustworthy Text Clipping Finding at a stable clipping boundary. All three Scenarios are validated positive. The boundary is the Finding Subject; the affected text is separate. Observe whether the participant can read before/after Evidence and identify a plausible CSS investigation without treating Possible Cause as a diagnosis.
- B: flexible normal content produces no supported Finding at the controlled viewport for each Scenario. Observe whether the participant avoids claiming the interface is proven correct.
- C: all visible content is editable and outside Mutation Eligibility. Each Scenario has zero eligible targets and no Findings. Observe whether the participant distinguishes a coverage limitation from demonstrated robustness or a Scenario-caused defect.
- All three: explicit Restore and native Download Report are fixture-tested. A controlled conflict may be explored only after the core uncoached tasks, with a separate synthetic fixture; it must not overwrite the primary outcome or be explained as a Finding.

The installed-extension fixture suite validates these outcomes through public controls. Re-run it when changing the fixture, candidate, browser, viewport, or font assumptions. Do not change target layout during a Run to rescue a study outcome.

## Measures and decision rule

Use tasks and interpretation, not Finding count, as the unit of success. Record unassisted/assisted/failed/skipped for toolbar entry, choosing and explaining one Scenario, interpreting the result and coverage, inspecting a subject or Primary Contributor, reading before/after Evidence, identifying an investigation area, Restore/reload-required confidence, and producing useful Markdown. Measure seconds from the goal prompt to the first result the participant can explain accurately; no arbitrary speed cutoff is a success condition.

Record confusions explicitly: Finding versus inconclusive; Evidence versus severity; boundary versus affected element; Possible Cause versus diagnosis; and no-Finding versus coverage limitation. Ask report usefulness and actionability questions after observation, without collecting the report.

Before recruitment, use this minimum interpretation threshold: at least 80% rounded up of six to eight qualifying participants must complete the core workflow correctly without substantive coaching (5/6, 6/7, or 7/8). More than half must meaningfully attempt the participant-owned phase (4/6, 4/7, or 5/8), with exclusions reported transparently. These are formative decision rules, not statistical reliability or market-demand claims.

For a future human study, any systematic terminology, trust, workflow, inspection, Restore, report, or UI interference problem triggers iteration and focused retesting with new qualifying participants. A safety/privacy/attribution defect blocks release regardless of counts. A human study report must choose launch, iterate, or blocked, link the redacted evidence, preserve unresolved gates, and explain exclusions. Human outcomes remain unverified until observed; the current launch Product Validation gate follows the explicitly simulated method above.

## Fixture verification

On Chrome 155.0.8059.85/macOS, all nine combinations of three controlled fixtures and three Scenarios passed through the installed extension UI, including explicit Restore and the then-current native Copy action (historical evidence; superseded by ADR-0031). Lint, strict types, and artifact checks passed. No participant observations were performed.
