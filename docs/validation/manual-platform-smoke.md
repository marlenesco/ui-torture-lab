# Manual Chrome platform smoke sign-off

Use this checklist for issue #26 on macOS, Windows and Linux separately. All three manual sign-offs are pending; Windows has no operated host, and the Linux authorization failure/correction is recorded in [the technical matrix](technical-matrix.md). Automated results do not substitute for this record.

## Preparation

1. Use a clean checkout of public commit `7b579c0662d1454ca92836761b9f85bb79748ad6`, the protected main merge containing PR #51 and the 1.0.0 candidate, with exact Node from `.node-version` and pnpm from `packageManager`. Record any intentionally selected successor before the session. Run `pnpm install --frozen-lockfile` and `pnpm build`. The older `4a20806` and `4ed925d` records are historical baseline evidence, not the smoke candidate.
2. Load `apps/extension/.output/chrome-mv3` as an unpacked extension in normal desktop Chrome stable. Record actual OS/browser versions, source SHA and SHA-256 of the manifest, background.js and document-runtime.js. Version 1.0.0 is a release candidate; the Official Distribution is not yet published.
3. Start `pnpm dev:fixtures` for original synthetic HTTP fixtures. For the eight static site routes, run `pnpm --filter @ui-torture-lab/site exec astro preview --host 127.0.0.1`. The public site is available at https://ui-torture-lab.pages.dev; record whether M9 uses that deployed build or a local preview. Local builds default to a local canonical unless SITE_URL is supplied. Close both processes afterward. Use only original synthetic pages for recorded evidence.

## Checklist

| ID | Manual action | Required observation |
| --- | --- | --- |
| M1 | Inspect manifest/install state; attempt Incognito access | Exactly activeTab/scripting/storage, no persistent host access, Chrome floor 155; Incognito unavailable |
| M2 | On `/text-clipping-run/`, `/horizontal-containment-run/` and `/viewport-overflow-run/`, authorize with the real toolbar; exercise each compatible Scenario, inspect Findings and Restore | Explicit authorization only; all three Detectors represented; comparable Evidence, no false attribution. Subject/range highlights reveal the first relevant area and stay aligned after scroll/resize; Restore clears them and restores original owned values |
| M3 | Collapse, close and reopen the UI during a Run; click the SVG in a labeled action, use keyboard controls and a small viewport | Close removes all visible controls and highlights; only another real toolbar action reopens the panel. Run/Evidence remain consistent, one runtime, Restore available; no page-width or scroll contamination |
| M4 | Expand and collapse the Markdown using its plain eye icon, then compare preview and downloaded .md bytes; cancel a browser save and exercise an initiation failure when possible | Preview starts collapsed, keyboard activation works, and toggling alone downloads nothing. Download follows its click only; exact UTF-8 preview equality, stable suggested filename and selectable fallback. The UI reports a request, not completion; downloaded files survive clearing/closing. No query/fragment, form values or hidden operational fields |
| M5 | After Apply, change an owned value using DevTools; request Restore | External change preserved, reload-required displayed, next Run blocked; true reload requires fresh toolbar authorization |
| M6 | Exercise history/hash/same-URL navigation, reload, back/forward, Page Exit and BFCache when available | Grant revoked, cleanup attempted, snapshot non-live; no automatic Run/grant resumption. Record observed BFCache hit/miss; do not infer it from disconnect |
| M7 | Interrupt the service worker/runtime using extension DevTools; disable the extension; close the target tab | Local Restore and termination limits visible; no silent reauthorization. Record each interruption separately; reload the fixture between interruption cases. After an extension reload/update with orphan controls, a new toolbar action must reject admission and request a true page reload; no second panel or overlay may mount. Only the current runtime may reconnect its controls. New Scenarios remain disabled until its grant acknowledgement; local Restore remains available after transport loss |
| M8 | Inspect extension Network and session/local/sync storage during Runs, Restore and tab close | No extension application request or capture; one reduced session result per tab, no durable history, deletion after tab close. Distinguish fixture traffic |
| M9 | Disable JavaScript; visit `/`, `/docs/`, `/scope/`, `/install/`, `/privacy/`, `/permissions/`, `/license/` and `/support/` on the local static preview | All routes/navigation work; visible focus, usable narrow layout, accurate pre-release/install status; consistent canonical paths |
| M10 | On Linux/Chrome 156 or its current stable successor, open/close several synthetic tabs and authorize each once with the actual toolbar | Record rejected initial authorization, badge/title feedback and whether the host mounted. Do not replay a click to hide failure; compare with the captured automated failure |

For M2, use compatible positives and negatives established in `tests/fixtures/pages` and record the exact synthetic path and Scenario. M7 checks best-effort limits, not guaranteed cleanup after forcible context destruction. M10 contributes diagnosis; it cannot clear failing strict CI by itself.

## Blank record — copy once per platform

```text
Operator:
Date/time (UTC):
Platform / OS version / architecture:
Chrome stable version:
Source SHA:
Node / pnpm versions:
Manifest version and SHA-256:
background.js SHA-256:
document-runtime.js SHA-256:
M1:
M2 (Scenario/Detector and synthetic fixture):
M3:
M4:
M5:
M6 (including observed BFCache hit/miss):
M7 (interruption type and outcome):
M8:
M9:
M10:
Overall: pending / passed / blocked
Blocker, synthetic reproduction, owner and retest requirement:
```

Record `passed`, `blocked` or `not observed` for every item, with a concise synthetic outcome. Leave unknowns open. Do not attach private page content, reports, clipboard data, URLs, locators, credentials or participant recordings. Unsafe Restore, false attribution, hidden export data, unexpected extension requests, undeclared retention or artifact-contract divergence block progression regardless of other outcomes.
