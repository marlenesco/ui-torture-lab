# Candidate review: standards and specification

Fixed point: main after PR #46, `3a134c7a0b127a0bfec1776bd1f014823419f41a`. Both axes were reviewed independently under the repository code-review skill. This record describes implementation findings and corrections, not a release approval.

## Standards

- **Authorization boundary (original P1, corrected):** reauthorization awaited snapshot storage after stopping the former navigation observer. A committed transition during that wait could grant the later route. The first native probe now installs a provisional one-shot navigation/Page Exit guard; bootstrap and final authorization validate it, including after awaited acknowledgement. The guard handles same-URL entries and drops its transient URL/listeners. Background token commits and finalization are serialized and older toolbar attempts cannot supersede newer ones. This preserves ADR-0028's logical Target Page boundary.
- **Reentrant Restore (original P2, corrected):** a synchronous subscriber could end the target when Restore published its restoring phase, clearing the journal before the next dereference. Restore now captures the journal before publication and exits if target end changed ownership. Completed comparable Evidence remains completed during this transition. The public Engine regression reproduced the original null dereference and now passes, preserving ADR-0023's independence from detachable clients.
- **Non-blocking judgment call, deferred:** browser/extension setup is repeated in several test files. A small shared harness could reduce duplication, but should preserve each fixture's independent browser and worker-suspension controls. This is an optional follow-up, not a correctness blocker or a reason for unrelated refactoring here.

## Spec

- **Issue #19 authorization semantics (corrected):** an observed logical-page transition must invalidate the Explicit Page Grant, including during bootstrap or pending reauthorization. New built-extension cases cover all three gaps between four injections and both route-changing and same-URL transitions during a held acknowledgement.
- **Issue #24 artifact identity (corrected):** pre-build metadata must not be paired with hashes of rebuilt output. Release verification now reads and validates the final manifest after rebuilding, derives the final tag, and rejects a rebuilt version without the matching source tag. Dedicated orchestration tests cover stale metadata, changed identity, failed preflight, and failed artifact build.
- **Issues #21/#24 capture prohibition (corrected):** the three-permission budget alone does not prohibit screenshots because activeTab can permit capture. Static guards now explicitly reject captureVisibleTab, related tab/media capture paths, and computed-property variants, with adversarial tests. No screenshot exposure was observed in the implemented extension.

- **Issue #19 transient-attempt cleanup (follow-up, corrected):** rejected bootstrap or unmounted/stale authorization attempts now release only their own provisional guard, dropping the full comparison URL and listeners. Token-scoped cancellation cannot stop a newer attempt. VM regressions cover non-HTML and other rejection paths, fallback observation, and repeated cancellation. Unsupported protocols still return before any injection.

Both axes confirm that Cloudflare, manual platform validation, participant studies, and publication are explicitly deferred gates rather than claimed completed work. Local validation after the fixes passed lint, strict types, build, 67 contract tests, 166 E2E tests, and artifact checks. Tests retain the existing timeout/retry policy.

Counts: Standards had two corrected correctness findings and one deferred non-blocking duplication heuristic (worst original: authorization boundary, P1); Spec had three original and one follow-up corrected findings (worst original: authorization boundary). No unresolved correctness finding remains from this review.

A subsequent parent regression also prevents stale authorized toolbar feedback after context invalidation. Public CI exposed two test-probe timeouts on Chrome 156/Linux; the targeted stability follow-up and strict no-flaky CI gate are recorded in technical-matrix.md.
