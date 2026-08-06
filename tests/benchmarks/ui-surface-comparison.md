# UI surface comparison

This engineering spike compares the two candidate UI surfaces required by issue #4. It was run on Google Chrome stable 150.0.7871.188 on macOS with the controlled [`extension-ui-contamination`](../fixtures/pages/extension-ui-contamination/index.html) fixture. The automated coverage lives in [`ui-surface-comparison.spec.ts`](../e2e/ui-surface-comparison.spec.ts) and [`target-page-authorization.spec.ts`](../e2e/target-page-authorization.spec.ts).

## Geometry

| Candidate and state | `innerWidth` | `documentElement.clientWidth` | document/body scroll width | Resize events | Breakpoint |
| --- | ---: | ---: | ---: | ---: | --- |
| Floating panel before opening | unchanged baseline | unchanged baseline | unchanged baseline | 0 | unchanged |
| Floating panel after opening | unchanged baseline | unchanged baseline | unchanged baseline | 0 | unchanged |
| Side Panel before opening | 900 px | 900 px | 900 / 900 px | 0 | `wide` |
| Side Panel after opening | 514 px | 514 px | 514 / 514 px | 36 | `narrow` |

The browser outer width remained 900 px for Side Panel. The change therefore came from Chrome reallocating the browser content bounds, not from the fixture. The floating surface also preserved geometry at 320 x 480 and stayed within all four viewport edges.

## Lifecycle and platform behavior

| Concern | Floating Shadow DOM panel | Chrome Side Panel |
| --- | --- | --- |
| Permission change | None; production remains `activeTab`, `scripting`, `storage` | Requires `sidePanel` |
| Toolbar grant | Uses the explicit action click, then injects into the granted tab | Action-toggle behavior opens browser UI without the same `activeTab` grant path |
| Tab association | Injected into exactly the authorized `documentId`; reload removes it and a new action creates a new runtime | Remains associated with the Chrome window and stayed open across target reload and navigation |
| Collapse / reopen | Reuses the same runtime and host | Chrome owns the surface lifecycle |
| Host removed by page | Explicit toolbar action remounts one host and one overlay on the existing runtime | Not applicable to browser-owned UI |
| Event boundary | Composed UI pointer, keyboard, form, focus, drag, and wheel events stop at the Shadow Root before Target Page bubble handlers; capture handlers run earlier and may observe them, while normal page events remain operational | Separate extension document |
| DevTools | With docked DevTools open before the baseline, opening the panel kept the resulting 545 px viewport and scroll width unchanged and mounted one inspectable open Shadow Root | Can coexist with DevTools, but independently consumes browser content width |
| Small viewport | `min(360px, 100vw - 24px)`, internal scrolling, no new document overflow | Further reduces the Target Page content viewport |

## Measurement safety and ownership

The selected runtime keeps direct references to the panel host, panel Shadow Root, overlay host, and overlay Shadow Root. A single ownership predicate recognizes those roots and descendants; DOM attributes exist only for diagnostics and tests. This predicate is the exclusion contract for future traversal, eligibility, Mutation, measurement, Evidence, contributor discovery, and locator generation.

Before every Baseline or mutated Evidence acquisition, the runtime's measurement-safe guard makes both extension roots non-rendered, including all diagnostic highlights. It restores their exact previous inline `display` value and priority in a `finally` block. Baseline and mutated acquisition must use this same guard; highlights are created only after Evidence capture.

## Reproduction

```text
pnpm --filter extension build
pnpm exec playwright test tests/e2e/ui-surface-comparison.spec.ts
pnpm exec playwright test tests/e2e/target-page-authorization.spec.ts
```

The minimal rejected candidate is retained under [`ui-surface-side-panel`](./ui-surface-side-panel/) so the comparison remains reproducible without adding `sidePanel` to the production extension.
