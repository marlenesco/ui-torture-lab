# UI Torture Lab

UI Torture Lab is a pre-release Chrome desktop extension for deterministic text
stress testing with measurable before-and-after Evidence.

> **Project status:** the development build implements the text stress workflow.
> Manual platform and Product Validation remain pending; no Official Distribution
> is published on Chrome Web Store.

Website and usage documentation: https://ui-torture-lab.pages.dev.

The repository keeps the browser-DOM-aware Engine, Chrome Extension Adapter,
Official Website, synthetic fixtures, tests, and product documentation in one
place so implementation and public claims can evolve together.

## Requirements

- Node.js 24.13.1
- pnpm 11.20.0 through Corepack
- Google Chrome desktop stable for installed-extension validation

## Setup

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install chrome
pnpm check
```

Useful development commands:

```sh
pnpm dev:extension
pnpm dev:site
pnpm dev:fixtures
```

## Workspace

- `apps/extension` — WXT Chrome MV3 application and Chrome Extension Adapter
- `apps/site` — static Astro Official Website
- `packages/engine` — DOM- and CSS-aware Engine, independent of React, WXT,
  and Chrome Extension APIs
- `tests/fixtures` — project-owned deterministic HTTP fixtures
- `tests/e2e` — browser-level Technical Validation harness
- `docs/adr` — system-wide architectural decisions
- `CONTEXT.md` — canonical domain vocabulary

The repository intentionally has no generic shared package, per-Scenario
package, per-Detector package, backend, analytics service, or Turborepo setup.

## Navigation safety

Observed top-level History, fragment, Navigation API, and back/forward entry changes end the current Target Page authorization. The extension attempts conflict-aware Restore, retains only a non-live Previous-Target Snapshot, and requires another toolbar action. Conflicts or unverified cleanup require a true reload. Navigation is never intercepted or prevented.

Stable-route SPAs remain supported. Private router transitions with no observable history entry change are outside this guarantee: Restore before those transitions. When Navigation API entries are unavailable, the UI warns that observation is incomplete; Restore before changing SPA routes. See the [Chrome observation benchmark](tests/benchmarks/same-document-navigation.md).

Page Exit (`pagehide`) synchronously revokes the context, cancels pending work, and attempts conflict-aware Restore without waiting for UI or messaging. A BFCache return never resumes the old grant. Use the toolbar again after verified cleanup; conflicts require a true reload. A lost extension connection clears the Run indicator but does not prove Page Exit or automatically end a live Run. Abrupt process termination cannot guarantee cleanup or final snapshot delivery. See the [Page Exit benchmark](tests/benchmarks/page-exit-bfcache.md).

## Contributing and support

Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change. Public bug
reports and feature requests use GitHub Issues on a best-effort basis. Do not
post credentials, authenticated URLs, private page content, proprietary source,
or unredacted reports.

Security vulnerabilities must use the private process in
[SECURITY.md](SECURITY.md). General support boundaries are described in
[SUPPORT.md](SUPPORT.md).

## License

Original project code and materials are licensed under the
[Apache License 2.0](LICENSE). Third-party dependencies and separately identified
materials remain under their own licenses. Source-code rights do not designate a
modified distribution as the Official UI Torture Lab product.
