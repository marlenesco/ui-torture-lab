# Release verification and reconstruction

This procedure prepares evidence; it does not submit, upload, publish, create tags, or modify protection rules. The current 0.0.0 pre-release candidate is intentionally ineligible for publication. Site origin and Store listing remain unconfigured. Human launch gates in `launch-gates.json` are pending.

## Reconstruct a candidate

Use a clean checkout of the intended public commit. Install exactly the Node version in `.node-version` and pnpm from `packageManager`, then:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chrome
SITE_URL=https://actual-official-origin.example pnpm check
```

Replace the example origin with the verified official origin. `pnpm check` runs lint, strict types, build, contracts, E2E, and the artifact gate. It never repairs or rewrites generated output to make checks pass. Chrome desktop stable must be installed; the validated minimum is 155, enforced by the manifest. Other browsers and channels are outside support. See `tests/benchmarks/` for measured lifecycle and geometry limits.

The extension output includes background.js, document-runtime.js, manifest.json, and THIRD_PARTY_NOTICES.txt. The site output is portable static HTML/CSS. Neither includes a service backend, account, entitlement, remote code, or project runtime service. Generated output stays outside Git; public source, the lockfile, build environment, manifest version, and validation record identify a candidate.

## Artifact gate

```sh
pnpm check:artifacts
```

The read-only gate names the exact path and divergence. It checks the permission budget, Incognito, Chrome floor, four reviewed toolbar injections plus exact-attempt cancellation with main-frame/document addressing in ISOLATED, script/page bridges, network APIs, persistent storage, first-party framework inspection, unexpected extension files, executable site output, remote assets, workflow pinning, and common credential/private-URL shapes. Separate contract suites compare site, listing, privacy, permissions, retention, browser boundary, and export commitments. Runtime tests observe actual network, session data, native Markdown downloads, frame policy, and lifecycle behavior.

A failure blocks progression. Review source or contract intentionally; never patch artifacts to bypass the gate. Static scanning is a regression guard, not a formal security proof. Keep the dependency/license and asset-provenance review in `dependencies.md` current. Source review remains required for arbitrary data, obfuscated capabilities, and provenance that cannot be inferred automatically.

## Official release record

After Technical Validation, Product Validation, site deployment, verified canonical listing identity, public protected source, and the intentional version/tag are ready, record the actual outcomes in `launch-gates.json` and the URLs in `public-contract.json`. Those records must be backed by linked evidence; pending, blocked, or unknown is never passed.

From a clean checkout of the protected public main commit, with the matching `v<manifest-version>` tag and exact declared Node/pnpm:

```sh
SITE_URL=https://actual-official-origin.example node scripts/create-release-record.mjs
```

The script fails closed on missing gates, placeholders, an untraceable tag, dirty source, wrong build environment, private/unprotected source, or a mismatched main commit. It verifies public GitHub source read-only, runs the complete gate, then writes `.scratch/release-record.json` containing commit, tag, manifest version, environment, build command, browser floor, permissions, canonical URLs, and SHA-256 hashes of the lockfile and every extension/site artifact. Preserve this record with the actual release evidence before submission. The script performs no publication.

A Store listing identity can exist before approval; the website must continue to say publication is pending until the corresponding Official Distribution is actually available. Follow issue #29 for submission, final installed-artifact smoke validation, and release notes. A prior site deployment rollback does not roll back the installed extension. A faulty extension release requires withdrawal or a new verified version through official channels; never promise automatic restoration of previously changed pages.

## Guardrail milestone evidence

On 2026-10-25, Chrome 155.0.8059.85/macOS: lint, strict types, production build, 52 contract tests, 145 E2E tests, and the read-only artifact gate passed. Adversarial policy tests reached 100% line/function and 96.32% branch coverage. These results establish the automated candidate gate; they do not mark the pending human or public-release gates passed.

Release identity is checked again after `pnpm check` rebuilds the artifacts. The record uses the final manifest's version, matching tag, and permissions alongside the final hashes; stale generated metadata cannot describe a different rebuilt artifact. Explicit Chrome/media capture APIs are rejected independently of the permission budget, because temporary activeTab access can itself permit capture.
