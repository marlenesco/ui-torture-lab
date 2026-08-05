# Domain Docs

How engineering skills should consume this repository's domain documentation when exploring the codebase.

## Layout

This repository uses a single-context domain layout:

- `CONTEXT.md` contains the shared domain vocabulary.
- `docs/adr/` contains system-wide architectural decisions.
- No `CONTEXT-MAP.md` or context-specific glossary is currently used.

## Before exploring, read these

- Read `CONTEXT.md` at the repository root.
- Read the ADRs under `docs/adr/` that affect the area being investigated.

If either location does not exist, proceed silently. Do not propose creating domain documentation preemptively. The `domain-modeling` skill creates or updates it when terminology or decisions are actually resolved.

## ADR routing

- **Evidence, identity, stability, and Run safety**: ADRs 0001-0005 and 0010-0011.
- **MVP Scenarios and Detectors**: ADRs 0006-0009 and 0012-0016.
- **Retention, permissions, privacy, and reporting**: ADRs 0017-0020.
- **Official Website and repository architecture**: ADRs 0021-0024.
- **Public source, licensing, and Official Distribution**: ADRs 0025-0026.
- **Execution and navigation lifecycle**: ADRs 0027-0029.

Read the named files rather than relying only on these ranges; new ADRs may extend a topic.

## Non-negotiable cross-cutting invariants

- A Finding requires comparable before-and-after Evidence for the same strictly identified DOM node and reports only a new or measurably worsened supported regression.
- Unreliable comparisons are inconclusive; missing a possible Finding is preferable to false attribution.
- Mutation ownership and conflict-aware Restore remain Engine responsibilities, independent of React and Extension UI lifecycle.
- Code operating against the Target Page stays in Chrome's `ISOLATED` world and uses only the supported top-level light DOM.
- Permission, retention, redaction, network, browser, and product-capability changes must remain consistent with the Public Product Contract and its ADRs.
- The MVP reports measured deltas without severity, confidence percentages, or global quality scores.

## Use the glossary's vocabulary

When output names a domain concept—in an issue title, specification, refactor proposal, hypothesis, or test—use the term defined in `CONTEXT.md`.

Do not drift toward synonyms that the glossary explicitly marks with `_Avoid_`.

If a required concept is absent, reconsider whether the new terminology is necessary. When it represents a genuine domain gap, route it through `domain-modeling`.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly rather than silently overriding it:

> _Contradicts ADR-0007 — worth reopening because…_
