# UI Torture Lab

UI Torture Lab is a planned Chrome desktop extension for deterministic text
stress testing with measurable before-and-after Evidence.

> **Project status:** public workspace scaffold. No Official Distribution or
> Target Page analysis workflow is available yet.

The repository keeps the browser-DOM-aware Engine, Chrome Extension Adapter,
Official Website, synthetic fixtures, tests, and product documentation in one
place so implementation and public claims can evolve together.

## Requirements

- Node.js 24.13.1
- pnpm 11.20.0 through Corepack
- Google Chrome desktop stable for future Official Distribution validation

## Setup

```sh
corepack enable
pnpm install
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
