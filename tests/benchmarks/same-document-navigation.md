# Same-document navigation observation

Validated on Google Chrome desktop stable 155.0.8059.85 on macOS, using the built Manifest V3 extension and `chrome.scripting.executeScript` with `world: "ISOLATED"`.

## Observed behavior

The committed `navigation.currententrychange` event is delivered to the extension's isolated listener for History push and replace, same-URL state replacement, anchor fragments, back/forward traversal, Navigation API fragment navigation, and `navigation.updateCurrentEntry()`. The grant is conservatively invalidated for every observed entry change, including same-URL and state-only updates; no route semantics or stored state are inspected.

The synthetic History router commits before changing its content. The Navigation API router's interception handler observes already-restored text. These fixtures establish the standard mechanisms; they do not establish compatibility with every router library or ordering of earlier page listeners.

A canceled Navigation API attempt does not produce a commit or end the Run. Child-frame history changes and ordinary DOM updates on a stable route do not revoke the top-level grant. The extension does not intercept, prevent, replay, or reload navigation.

## Limits

A router transition expressed only in private application state, without an observable history entry change, is not detected. Restore before such transitions. No History monkey patch, framework integration, MAIN-world code, page bridge, browsing-history capture, additional permission, or URL polling is used.

When Navigation entries are unavailable or disabled, only standard `popstate` and `hashchange` observations remain. The UI explicitly warns that observation is incomplete and requires Restore before SPA route changes. That fallback does not claim push/replace coverage.

## Safety and evidence

The Engine's synchronous target-end operation revokes future work, cancels pending frame/timer waits, performs conflict-aware Restore, and releases live Finding references. A Run interrupted before reliable mutated Evidence produces no Findings. Already-completed comparable Evidence is retained with its original minimized page metadata and termination reason as a non-live Previous-Target Snapshot. It is not remeasured or rematched after navigation.

Each toolbar authorization has a fresh token. Background updates validate that token again inside the tab's serialized work queue, so an expired logical context cannot overwrite results, clear a later result, reactivate its Run indicator, or revoke a later grant even when Chrome preserves the same Document ID.

Verified Restore permits a fresh Engine context only after another toolbar action. Conflict or uncertainty, including reentrant invalidation during a write, remains reload-required until the Document is replaced.

## Reproduction

```sh
pnpm build
pnpm exec playwright test tests/e2e/same-document-navigation.spec.ts tests/e2e/target-end-engine.spec.ts --workers=2
pnpm test:contracts
```

Platform rationale and primary sources: [same-document-navigation-primary-sources.md](../../docs/research/same-document-navigation-primary-sources.md).
