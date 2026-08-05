# Contributing to UI Torture Lab

Thank you for helping improve UI Torture Lab. The project is currently building
its MVP and keeps scope deliberately narrow.

## Supported development target

The Official Distribution targets the current Google Chrome desktop stable
release with Manifest V3. Other Chromium browsers, Firefox, Safari, mobile,
iframe traversal, Shadow DOM traversal, plugins, and custom runtime Scenario or
Detector loading are outside the MVP support contract.

## Local setup

```sh
corepack enable
pnpm install
pnpm exec playwright install chrome
pnpm check
```

Use the Node and pnpm versions declared by the repository. Keep the lockfile in
the same change as intentional dependency updates.

## Architecture boundaries

- The Engine owns Run behavior, domain state, page Mutations, measurement,
  Restore, redaction, and reporting.
- The Engine may use browser DOM and CSS APIs but must not import React, WXT, or
  Chrome Extension APIs.
- React belongs only to Extension UI rendering and presentation state.
- Chrome-specific lifecycle, permissions, messaging, and storage remain in the
  Chrome Extension Adapter.
- The Official Website remains static, provider-independent, and free of
  analytics, backend services, and required client-side JavaScript.

Use the vocabulary in `CONTEXT.md` and respect relevant ADRs. If a proposal
contradicts an ADR, surface the conflict instead of silently changing the
contract.

## Tests and fixtures

Tests should observe public seams rather than private helpers. Every positive
Scenario or Detector fixture needs a compatible negative case and, where
relevant, intentional valid behavior that must not produce a Finding.

Fixtures must be synthetic, minimal, deterministic, and created for this
project. Do not submit copied production pages, authenticated URLs, personal
data, credentials, proprietary assets, complete customer HTML, or unredacted
Current Run Results.

A new Scenario or Detector proposal must define eligibility, exclusions,
Baseline Evidence, Mutated Evidence, comparison and attribution rules,
inconclusive conditions, Restore implications, positive fixtures, negative
fixtures, and noise evaluation. Approximate warnings without deterministic
Evidence are not accepted.

## Documentation

Changes to permissions, retention, privacy, Supported Scope, Scenarios,
Detectors, browser support, reporting, or distribution must update the Public
Product Contract and Chrome Web Store guidance in the same pull request.

## Contribution license

Unless explicitly stated otherwise, contributions submitted to this repository
are provided under Apache License 2.0. The MVP requires no contributor license
agreement or copyright assignment.

Opening an issue or pull request does not guarantee acceptance, implementation,
a release date, or backward compatibility for internal APIs.
