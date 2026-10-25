# Static Cloudflare Pages deployment

Status recorded 2026-10-25: the static pre-release website is deployed at https://ui-torture-lab.pages.dev. The maintainer authorized the native GitHub App for only `marlenesco/ui-torture-lab`. Production and preview payload checks pass, and a live rollback to a prior successful production deployment has been demonstrated for issue #25. No Official Distribution or Chrome Web Store availability is implied.

## Actual project settings

| Setting | Value |
| --- | --- |
| Provider | Cloudflare Pages Free, native Git integration; project `ui-torture-lab` |
| Repository scope | Only `marlenesco/ui-torture-lab` |
| Production branch | `main` |
| Root directory | Repository root |
| Build command | `pnpm --filter @ui-torture-lab/site build` |
| Output directory | `apps/site/dist` |
| Node | `24.13.1`, from `.node-version` / `NODE_VERSION` |
| pnpm | `11.20.0`, from packageManager / `PNPM_VERSION` |
| Canonical origin | `SITE_URL=https://ui-torture-lab.pages.dev` in Production and Preview |
| Preview policy | All non-production branches of the connected repository; native PR checks/comments enabled |
| Runtime | Static files only; no Cloudflare adapter or application runtime |

Cloudflare documents version overrides through `NODE_VERSION`, `.node-version`, and `PNPM_VERSION`; pin these rather than accepting the build image's defaults. Verify the install log uses the frozen root lockfile and declared package manager. See the [build image documentation](https://developers.cloudflare.com/pages/configuration/build-image/).

The project already compiles static Astro output. Do not add the SSR adapter from a framework scaffold. Native [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/) supplies branch previews and PR status; choose the Pages product, not a Workers build. Repository authorization must be limited to this repository. The intended owner approved installation at the explicit GitHub permission screen. Selected-repository access is scoped to this repository, with the app-requested metadata read and administration/checks/code/deployments/pull-request read/write capabilities. No token or private account identifier is stored here.

## Build watch paths

Include `apps/site/*`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.node-version`, `tsconfig.base.json`, and `docs/distribution/*`. Root dependency changes can alter installation or site output even when extension source is unchanged. Leave excludes empty; the include set avoids ordinary extension-only rebuilds. Add any new root build input when introduced. Cloudflare's trailing wildcard includes nested paths, and oversized pushes may bypass filtering. See [build watch paths](https://developers.cloudflare.com/pages/configuration/build-watch-paths/).

## Deployment evidence

- Ownership: maintainer `marlenesco`, personal Cloudflare account; no private account IDs or credentials are recorded.
- Pages project/domain: `ui-torture-lab`, https://ui-torture-lab.pages.dev. No custom domain or DNS change was made.
- Source: public main `4ed925d7b99dc96b95691638754348f2081265b2`, the PR #48 merge. [Main CI](https://github.com/marlenesco/ui-torture-lab/actions/runs/40213504538) passed 75 contracts, 167 E2E tests and 65 authorization checks without retries or flakiness.
- Initial production: `ac7488a1-d36e-48aa-88cc-9343f2e9ab06`, https://ac7488a1.ui-torture-lab.pages.dev, successful 48-second deployment.
- Identical rebuild for rollback testing: `8a5adccc-1892-46c3-90bd-003024db3fe6`, https://8a5adccc.ui-torture-lab.pages.dev, same source SHA, successful 38-second deployment.
- Build log confirms Node 24.13.1, pnpm 11.20.0, root lockfile up to date with resolution skipped, and `pnpm --filter @ui-torture-lab/site build`. Dependency installation spans the workspace and runs its existing prepare hooks; the production build compiles only the site. Cloudflare's install command is `pnpm install`; no alternative dependency graph was resolved.
- Output: eight static HTML files, with local CSS inlined by Astro. Every HTTPS route returns 200, the correct canonical URL, no script and no Set-Cookie header, and matches the equivalent local `SITE_URL` build byte for byte. See [HTTP evidence](../validation/records/2026-10-25-pages-production.json).
- No functions directory was found or uploaded. Production and Preview have no bindings or secrets; only NODE_VERSION, PNPM_VERSION and SITE_URL text variables. No Worker application, storage/database resource, adapter, analytics snippet or Zaraz configuration was added. The Metrics screen explicitly reports Web Analytics disabled.
- Build filters are configured with the seven include entries above and an empty exclude set. Production automatic builds and all non-production branch previews are enabled.
- Preview: `a37dce60-c68a-4138-8cb5-7800fbfe6a23` from `444845d8eeecda1aa6e00b12315621e3a3272eb8` on `issue-25-pages-deployment`; native Cloudflare check on PR #49 succeeded. All eight routes match the local static payload and keep production canonical URLs.
- Rollback: the native Roll back action returned production from `8a5adccc` to `ac7488a1`; the active deployment was confirmed in the dashboard and all eight production routes were rechecked. Both deployments have the same source and bytes, so this tests the real production pointer without introducing faulty content. The extension was unchanged.
- Portability: all eight routes also returned the exact artifact bytes from Python's ordinary `SimpleHTTPRequestHandler`; that temporary server was stopped. No provider runtime is required.
- Filter control: `f74b558` changes only `docs/validation/records/2026-10-25-pages-operations.json`, outside the include set. The provider explicitly recorded it as `skipped` with `No deployment available` (`cd92d6ee-21cf-4e3a-afcf-fb9755981a3d`), confirming that this unrelated change did not trigger a rebuild. Platform exceptions for empty/oversized pushes still apply.
- [Operational evidence](../validation/records/2026-10-25-pages-operations.json) records repository scope, production/preview identities, rollback and resource boundaries.

The hosting image bootstraps Corepack 0.36.0 and emits a non-fatal Node engine warning before activating the requested pnpm version. Both deployments nevertheless used the declared Node/pnpm and produced the verified static payload. This provider bootstrap warning is retained as a known build-image caveat; no workspace version was silently changed.

The website keeps its pre-release Store notice. `public-contract.json.siteOrigin` records the verified production origin; `storeListing` remains null and technical/product validation remain pending. `launch-gates.json.siteDeployment` records the completed hosting gate independently of the still-pending Technical and Product Validation gates.

## Rollback and escape path

Cloudflare can roll back to a prior successful production deployment; previews are not rollback targets. In the project's Deployments list, use the intended production deployment's actions and confirm Rollback to this deployment. Record old/new deployment identities and route smoke results. This operation changes the site, not the installed extension. See [Cloudflare rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/).

For migration, rebuild the same public commit and serve `apps/site/dist` from any ordinary static host; the artifact requires no provider runtime. Verify all routes and assets locally with the static-server command in `apps/site/README.md`, update the canonical origin intentionally, and coordinate DNS only with its owner. Leave the previous deployment available until the new origin is verified; this plan authorizes no deletion of accounts, projects, DNS zones, or deployment history.
