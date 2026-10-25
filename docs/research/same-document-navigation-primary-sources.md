# Same-document navigation and Page Exit: primary sources

Research date: 2026-10-25. Supports issues #19 and #20 and ADRs 0028–0029.

**Validation boundary:** these sources describe platform contracts. Actual delivery to this extension's `ISOLATED` world is checked separately by the [built-extension Chrome spike](../../tests/benchmarks/same-document-navigation.md). The source research does not imply blanket router compatibility.

## Navigation observations

- Chrome documents that `navigate` covers user and programmatic navigations, including legacy History API calls. It occurs while navigation can still be intercepted or canceled. Listening is different from calling `intercept()` or `preventDefault()`; this product must remain observational. [Chrome Navigation API guide](https://developer.chrome.com/docs/web-platform/navigation-api/)
- Updating the Navigation entry list fires `currententrychange` after the current entry changes. A same-document traversal uses this path; cross-document reactivation has a separate path. `updateCurrentEntry()` also fires this event, with `navigationType` equal to `null`. Therefore, an entry-change event does not necessarily mean that a route URL changed. [HTML Standard: entry-list updates and Navigation interface](https://html.spec.whatwg.org/multipage/nav-history-apis.html#the-navigation-api)
- For intercepted navigations, the specified order is `currententrychange` handlers, then interception handlers, then promise handlers. Earlier page code can already have changed the DOM; observation cannot guarantee that the page preserved the extension's Mutations. [HTML Standard: navigate event](https://html.spec.whatwg.org/multipage/nav-history-apis.html#the-navigate-event)
- Navigation entries/events are disabled for a non-fully-active Document, initial `about:blank`, or opaque origin; `currentEntry` is then `null`. API-property presence alone is insufficient feature detection. [HTML Standard: core infrastructure](https://html.spec.whatwg.org/multipage/nav-history-apis.html#navigation-api-core-infrastructure)
- Chrome documents that History `pushState()` and `replaceState()` update Navigation entries. Entry keys identify slots and can remain unchanged while URL or state changes. Comparing only URL or key would therefore discard relevant observations. [Chrome Navigation API guide: navigation entries](https://developer.chrome.com/docs/web-platform/navigation-api/#navigation-entries)

## Isolation and limits

Content-script JavaScript variables belong to an isolated execution environment; page variables are not accessible, although both environments interact with the document. This supports observing standard browser surfaces without joining framework/router internals, but the documentation does not promise event coverage for every interface in that world. [Chrome content-script isolation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#work_in_isolated_worlds)

Engineering conclusions for this project:

- Prefer committed entry changes for invalidating an actual transition. A `navigate` attempt that is later canceled must not be described as a committed route change.
- Do not deduplicate all observations by URL: same-URL history entry changes belong in the spike. Decide explicitly whether state-only `updateCurrentEntry()` also invalidates the grant.
- A router that changes only private application state has no established observable navigation boundary here. Do not claim detection through DOM changes or infer framework semantics.
- Legacy fragment/back-forward events are partial fallback candidates, not evidence of complete History API coverage. If full supported observation is unavailable, retain the ADR fallback: Restore before route changes and declare transitions during an Active Run unsupported.

## Page Exit and BFCache

`pagehide` covers both unloading and an attempt to enter BFCache. Its `persisted: true` value indicates an intention to cache, not successful caching. A later `pageshow.persisted: true` establishes restoration from BFCache. `unload` is unreliable and harms BFCache compatibility. [Chrome team's BFCache guidance](https://web.dev/articles/bfcache#observe-when-a-page-is-entering-bfcache)

Frozen pages suspend freezable tasks, including timers and callbacks, and may never resume. Cleanup that requires another task, timer, frame, or asynchronous acknowledgment cannot be its safety boundary. This supports ADR-0029's synchronous, in-document Restore before the handler returns; abrupt termination still has no cleanup guarantee. [Chrome Page Lifecycle guidance](https://developer.chrome.com/docs/web-platform/page-lifecycle-api#developer-recommendations-for-each-state)

Chrome's BFCache messaging change closes content-script message channels when a page enters BFCache; the old channel is not reopened on restoration. [Chrome extension messaging and BFCache](https://developer.chrome.com/blog/bfcache-extension-messaging-changes)

However, `Port.onDisconnect` also has other causes: absent listeners, frame/tab unload, or explicit disconnection. Treat it as lost reachability, not proof of BFCache. [Chrome port lifetime](https://developer.chrome.com/docs/extensions/develop/concepts/messaging#port-lifetime)

For this product, restored Documents must remain unauthorized until another toolbar action. Reconnecting a transport must not resume the old Run, Baseline, Mutation Journal, or live Evidence actions; conflicts and unverified cleanup remain reload-required. These are product decisions in ADR-0029, not automatic browser behavior.

## Planned spike matrix

The parent implementation should record browser version, actual `ISOLATED` injection, observed events/order, and pass/fail results for each case:

| Case | Required distinction |
| --- | --- |
| History push/replace with changed URL | Commit observed without History patching |
| Same-URL push/replace and state-only entry update | Deliberate grant policy; no URL-only deduplication |
| Fragment assignment and anchor link | Same Document retained; actual transition observed |
| Back/forward traversal | Entry transition observed without new authorization |
| Navigation API intercepted transition | Observation precedes the handler's later work where specified |
| Canceled Navigation API attempt | Attempt distinguished from commit |
| Minimal History, hash, and Navigation router fixtures | Demonstrate mechanisms, not blanket framework support |
| Navigation in a child frame | Does not invalidate the top-level grant |
| Missing/disabled Navigation API | Tested limitation and explicit fallback wording |
| Page Exit with verified/conflicting Restore | Synchronous local outcome, independent of transport |
| Successful BFCache restore and failed cache entry | No automatic continuation; fresh toolbar grant required |
| Port loss without navigation | Reachability loss distinguished from lifecycle proof |

No fixture should inspect `history.state`, Navigation entry state, framework globals, or page content merely to identify a route; do not retain a browsing history.
