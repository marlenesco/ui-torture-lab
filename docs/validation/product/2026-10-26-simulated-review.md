# Simulated Product Validation — 1.0.0

Decision date: 2026-10-26. **The adopted simulation criterion passes; publication
remains blocked by separate release prerequisites.** The owner explicitly replaced
the former six-to-eight-human launch requirement with six professional-role agent
reviews, while retaining the fact that actual human usability is unverified. See
[ADR-0032](../../adr/0032-adopt-explicitly-simulated-product-validation-for-launch.md).

## Method and evidence boundary

Six separate agent contexts reviewed the workflow from different professional
perspectives. They inspected source, actual screenshots and test definitions;
they did not execute browser sessions, run tests, observe people, measure task
times, collect quotations or operate participant-owned interfaces. Shared model
capabilities and product materials mean their judgments are not independent
human observations or a statistical reliability estimate.

The runtime is protected public main
`7b579c0662d1454ca92836761b9f85bb79748ad6`. The submission-material baseline is
`da94e8beb6b367fb10918e9365b131d2bc9bf203`; it contains no Extension/Engine changes
from that runtime. The coordinator's earlier native simulated-toolbar screenshot
capture is recorded in [capture.json](../../distribution/store-assets/capture.json).
That separate execution verifies exact synthetic Restore and visible report
availability; it does not itself download a report. Existing download tests and
the passing main CI provide separately identified automated evidence.

Human participants: **0**. Participant-owned interfaces: **0**. Reviewer browser
executions: **0**. New manual platform sign-offs: **0**. Source-assisted reviews
are deliberately not scored as uncoached task successes or percentages.

## Six perspectives

| Profile / agent | Observations grounded in the inspected materials | Outcome |
| --- | --- | --- |
| Frontend engineer / `launch_frontend` | Three direct Scenario actions map to documented stress conditions. The live `p#plan-name` Finding, computed overflow/white-space and locator point to the synthetic CSS. Completed Evidence and the Markdown formatter provide an investigation handoff without presenting a diagnosis or severity. | Scoped pass; no confirmed blocker |
| QA/lifecycle engineer / `launch_qa` | Source and existing test definitions distinguish single-attempt authorization, runtime-preserving panel close/reopen, conservative orphan rejection, conflict-aware Restore, navigation revocation and transport loss. The three screenshots represent one coherent Run and exact Restore. | Scoped pass; no confirmed blocker |
| Privacy/trust engineer / `launch_privacy` | Three permissions, trusted session retention and page metadata/excerpt disclosures agree with source. Download and preview share one redacted string, initiation failure reveals a fallback, and saved files have separate retention. Store certification remains an owner action. | Scoped pass; no confirmed blocker |
| UX/content designer / `launch_ux` | Screenshots distinguish authorized, active and completed states; computed Evidence and Possible Cause have different roles. Usage explains no Finding versus inconclusive. Download is labeled; subtle preview discovery and fixed-panel interference warrant later human observation. | Scoped pass; no confirmed blocker |
| Keyboard/accessibility-minded UI engineer / `launch_keyboard` | Source uses native buttons, named icon controls, decorative hidden SVGs, native disabled states and visible focus rules. Preview disclosure has state/target semantics and narrow-panel provisions. Actual focus recovery and assistive-technology behavior remain untested here. | Scoped pass; no confirmed blocker |
| Release/integration engineer / `launch_release` | Installation, authorized HTTP(S) targets, free accountless product use, reviewer workflow, package/version/permission identity and project credits align. Final Store identity, verified tag/package and Store-installed smoke remain separate prerequisites. | Scoped pass; no confirmed blocker |

All six read the relevant repository/domain guidance and reviewed the source and
artifact baseline above. Privacy inspected the authorization/report PNGs; the
other five inspected all three PNGs. Principal supporting materials:

- Screenshots, fixture, provenance and capture: `docs/distribution/store-assets/`.
- Workflow semantics and actions: `apps/extension/src/document-runtime/panel.tsx`,
  `runtime.tsx`, `markdown-report.tsx`, `markdown-download.ts`, `panel-style.ts`,
  `panel-icon.tsx`; `apps/extension/src/target-page/authorize.ts`.
- Evidence, redaction, report and Restore: `packages/engine/src/report/markdown.ts`,
  `detectors/text-clipping.ts`, `scenarios/long-text.ts`, `run/mutation-journal.ts`,
  `run/run-controller.ts`; adapter current-result/background sources.
- Existing definitions of browser regressions: `tests/e2e/markdown-report.spec.ts`,
  `panel-dismissal.spec.ts`, `runtime-generation.spec.ts`, `target-page-authorization.spec.ts`,
  `same-document-navigation.spec.ts`, `page-exit.spec.ts`, `distribution-lifecycle.spec.ts`;
  relevant contract tests. Reviewers read these definitions and did not rerun them.
- Public usage/scope/privacy/install/permissions copy, `NOTICE`, `SUPPORT.md`, the
  Store copy/field guide/reviewer instructions, release guards and ADRs 0010,
  0016–0019, 0027–0031 as relevant to each role.

## Non-blocking follow-ups

- Consider explicit Baseline/Mutated labels in the compact Text Clipping Evidence
  row and an in-panel no-Findings caveat or explanation of inconclusive counts.
- Retain the owner's requested plain eye icon; assess preview discoverability
  with people before changing that design. Accessible naming/title already exist.
- Consider an inline reminder about residual identifying context near downloads,
  easier clearing of a completed result, and clarification of the diagnostic
  highlight retained after Restore. Current behavior is accurately disclosed.
- Align the locator action's accessible name with its visible selection wording;
  verify keyboard/speech behavior and focus transitions in the manual checklist.
- Recheck screenshots against the final runtime before submission. Current
  captures intentionally identify `7b579c0`; recapture after runtime/UI changes.

None is represented as an observed user failure. No product behavior or launch
claim was changed to conceal a confirmed blocker. Historical protection/candidate
wording in the technical matrix was refreshed as a documentation follow-up.

## Gate decision and remaining work

The six reports meet the owner-approved Simulated Product Validation criterion:
all six perspectives report a scoped pass, exact materials and limitations, and
no unresolved confirmed blocker. `launch-gates.json.productValidation` can be
`passed` for **this declared simulation method only**. Human comprehension,
unassisted use, adoption and native platform usability remain unverified.

Technical Validation remains `pending`; issue #26 stays open, including the full
macOS/Windows/Linux manual checklist and unresolved Windows-host coverage. An
unsafe Restore, privacy/attribution defect or artifact divergence would still
block publication regardless of these reviews. Developer registration, actual
Store draft identity and privacy classifications, final protected source/tag and
release record, Google review and the final Store-installed smoke are not
established by this report. The release-record guard must continue to reject the
candidate while any required gate or identity is missing.

## Subsequent manual finding

Later on 2026-10-26, real operator testing found diagnostic highlight navigation,
scroll alignment and Restore-cleanup defects in the reviewed runtime. The scoped
AI desk passes above are preserved as historical outcomes, not a claim that the
reviewed build was defect-free. [The recovery record](../inspection-highlight-recovery.md)
links the reproduced symptoms and correction. The corrected UI requires focused
native retesting through Technical Validation; publication remains blocked until
that gate is completed.
