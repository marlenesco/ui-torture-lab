# Page Exit and BFCache safety

Validated with the built Manifest V3 extension on Google Chrome desktop stable 155.0.8059.85 on macOS.

## Observed behavior

Real navigation away and back restores the fixture from BFCache (`pageshow.persisted` is true). The same document runtime survives with cleaned DOM, a revoked grant, no live Finding actions, and a Previous-Target Snapshot. Another explicit toolbar action permits a fresh Run only after verified cleanup. Reload and forward navigation are covered separately.

A second test browser disables BFCache with a test-only launch flag to exercise the negative path: back creates a new, unauthorized Document with original text and no Extension UI until another toolbar action. Production code does not disable BFCache and registers no `unload` listener.

## Local ordering

Every top-level `pagehide` revokes authorization and synchronously calls the Engine target-end operation. Pending Scenario preparation and measurement frames are canceled, Restore is attempted in reverse order with ownership checks, and live Finding references are released. Tests hold frame callbacks and invoke them after restoration to prove old work cannot resume. Removed panel/highlight hosts, a throwing UI subscriber, and messaging that never acknowledges do not prevent cleanup. `pageshow.persisted` never resumes authorization, a Run, or a port.

External text conflicts remain untouched and block further mutation until a true reload. Reliable completed Evidence may remain in a serialized result; interrupted capture produces no Findings.

## Reachability and limits

The native extension port describes transport reachability. Its loss clears the toolbar Run indicator and displays a connection warning, without claiming Page Exit or BFCache and without abandoning a live Run's local Restore capability. Old-grant port disconnections cannot clear a newer grant's indicator. Worker startup clears stale indicators until a current runtime binds its grant.

Cleanup is bounded local work for a delivered lifecycle event. It cannot guarantee recovery after abrupt browser, tab, renderer, or extension termination before an event runs. Delivery of a final serialized snapshot is best effort and is not a prerequisite for local Restore. A restored document retains its local snapshot; a new document can expose the last snapshot successfully stored during that tab session. No cross-tab history or durable browsing record is introduced.

## Reproduction

```sh
pnpm build
pnpm exec playwright test tests/e2e/page-exit.spec.ts tests/e2e/target-end-engine.spec.ts --workers=2
pnpm test:contracts
```

The complete regression suite at this milestone passed 134 E2E tests and 38 contract tests, with lint, type checking, and production build passing.
