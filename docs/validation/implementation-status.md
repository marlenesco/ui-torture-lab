# Candidate implementation status

Recorded 2026-10-25 after PR #48 merged as `4ed925d7b99dc96b95691638754348f2081265b2`. GitHub confirmed #19–#24 and #27 closed. Pages hosting is deployed and validated; manual platform sign-off, the participant study and Official Distribution remain open.

| Issue | Candidate state | Evidence / remaining work |
| --- | --- | --- |
| #19 | Implemented and tested | `af242ad`: isolated same-document observation, synchronous target end, revoked logical grant, conflict-aware Restore, non-live snapshot, explicit reauthorization |
| #20 | Implemented and tested | `62fb446`: Page Exit/BFCache local cleanup, canceled work, no grant resume, native reachability distinction |
| #21 | Implemented and tested | `f980dba`: complete public built-extension workflow, all Scenarios/Detectors, suspension/interruption, network/session/clipboard checks |
| #22 | Implemented and tested locally | `80767e9`: static capability/operational site, no-JavaScript navigation, keyboard/responsive smoke; hosting is separate |
| #23 | Implemented and tested locally | `b788db9`: privacy, permissions, retention, licensing, free access, support, versioned Store copy and contract comparisons |
| #24 | Implemented and tested | `b9ed115`: read-only artifact gates, dependency/notices review, adversarial policy tests, traceable release-record preflight |
| #25 | Pages deployed and validated | Verified https://ui-torture-lab.pages.dev; repository-scoped Git integration, declared tools, root watch paths, eight-route artifact parity, branch preview and actual production rollback. Deployment settings/evidence are in the hosting record; no Store publication |
| #26 | Clean public validation and authorization correction tested; manual gates pending | Public main baseline: 70 contracts/166 E2E. The captured Linux authorization publication race now has a bounded single delayed recheck and supersession/tab-close cancellation. Local correction: 75 contracts/167 E2E, plus 65 authorization repetitions without retries. Strict PR and post-merge main CI passed; all three manual platform sign-offs remain open. See the technical matrix and baseline evidence record |
| #27 | Kit and controlled fixtures prepared and tested | `aa9d49b`: recruitment profile, uncoached script, privacy protocol, redacted template, nine installed-extension fixture combinations; no actual participants observed |
| #28 | Not conducted | Requires six to eight actual independent qualifying participants, meaningful participant-owned use, iteration and redacted launch decision |
| #29 | Not published | Hosting is complete; requires validation, protected public source/tag/version, verified canonical Store identity, submission/availability and final installed-artifact smoke |

The isolated clean local clone passed 52 contract tests and 160 E2E tests. Following independent review and additional regression fixes, the complete local gate passed 70 contract tests and 166 E2E tests, plus lint, strict types, production build and artifact checks. See the [two-axis review](candidate-review.md). See [Technical Validation](technical-matrix.md), the [Product Validation kit](product/README.md), [deployment handoff](../distribution/cloudflare-pages.md), and [release procedure](../distribution/release.md).

The candidate was merged through [PR #47](https://github.com/marlenesco/ui-torture-lab/pull/47). Its strict PR CI passed, but the post-merge main CI exposed a further authorization flake; the correction in this follow-up has deterministic contract and browser regressions, and passed strict PR and post-merge main CI. The baseline failure is retained as historical evidence. [The current technical matrix](technical-matrix.md) supersedes pre-merge source/environment status. Main protection was enabled and verified on 2026-10-26; see the [protection record](records/2026-10-26-main-protection.json). Required PR/CI controls apply to administrators, with zero mandatory independent approvals for the solo-maintainer workflow. Pages is now live; no custom domain/DNS change was needed. See the hosting evidence and the PR #48 final review.
