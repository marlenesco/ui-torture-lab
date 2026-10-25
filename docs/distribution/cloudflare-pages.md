# Static Cloudflare Pages deployment plan

Status: not deployed. Account ownership, Pages project, GitHub App authorization, public domain, preview build, and rollback demonstration are unresolved. The requested account selection is pending. No Cloudflare resource, integration, token, secret, custom domain, or deployment has been created. Issue #25 remains open.

## Proposed settings

| Setting | Value |
| --- | --- |
| Provider | Cloudflare Pages Free, native Git integration |
| Repository scope | Only `marlenesco/ui-torture-lab` |
| Production branch | `main` |
| Root directory | Repository root |
| Build command | `pnpm --filter @ui-torture-lab/site build` |
| Output directory | `apps/site/dist` |
| Node | `24.13.1`, from `.node-version` / `NODE_VERSION` |
| pnpm | `11.20.0`, from packageManager / `PNPM_VERSION` |
| Canonical origin | `SITE_URL` set to the actual verified official HTTPS origin |
| Preview policy | Internal branches and PRs where native integration permits |
| Runtime | Static files only; no Cloudflare adapter or application runtime |

Cloudflare documents version overrides through `NODE_VERSION`, `.node-version`, and `PNPM_VERSION`; pin these rather than accepting the build image's defaults. Verify the install log uses the frozen root lockfile and declared package manager. See the [build image documentation](https://developers.cloudflare.com/pages/configuration/build-image/).

The project already compiles static Astro output. Do not add the SSR adapter from a framework scaffold. Native [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/) supplies branch previews and PR status; choose the Pages product, not a Workers build. Repository authorization must be limited to this repository. Account selection and OAuth authorization require the intended owner.

## Build watch paths

Include `apps/site/*`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.node-version`, `tsconfig.base.json`, and `docs/distribution/*`. Root dependency changes can alter installation or site output even when extension source is unchanged. Leave excludes empty; the include set avoids ordinary extension-only rebuilds. Add any new root build input when introduced. Cloudflare's trailing wildcard includes nested paths, and oversized pushes may bypass filtering. See [build watch paths](https://developers.cloudflare.com/pages/configuration/build-watch-paths/).

## Deployment record to complete

- Intended account owner: unresolved; record a public ownership label, not credentials or private account identifiers.
- Pages project and active pages.dev domain: unresolved.
- Repository authorization: unresolved; verify selected-repository access.
- Production branch, build/output settings, environment versions and SITE_URL: unresolved.
- Source commit and production deployment identity: unresolved.
- All eight required routes, no-JavaScript navigation, local CSS, HTTPS canonical metadata: not yet verified on Pages.
- Preview deployment and unrelated-change watch-path behavior: not yet verified.
- Functions, Workers, bindings, KV, R2, D1, Durable Objects, secrets, Web Analytics, and Zaraz: must remain absent/disabled; not yet inspected in the actual account.
- Rollback target/result: not demonstrated.

Keep the candidate's pending Store-release notice. Set `public-contract.json.siteOrigin` only after the actual origin is established; a preview URL is not automatically the canonical production origin. Do not mark `launch-gates.json.siteDeployment` passed until deployment and rollback evidence exists.

## Rollback and escape path

Cloudflare can roll back to a prior successful production deployment; previews are not rollback targets. In the project's Deployments list, use the intended production deployment's actions and confirm Rollback to this deployment. Record old/new deployment identities and route smoke results. This operation changes the site, not the installed extension. See [Cloudflare rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/).

For migration, rebuild the same public commit and serve `apps/site/dist` from any ordinary static host; the artifact requires no provider runtime. Verify all routes and assets locally with the static-server command in `apps/site/README.md`, update the canonical origin intentionally, and coordinate DNS only with its owner. Leave the previous deployment available until the new origin is verified; this plan authorizes no deletion of accounts, projects, DNS zones, or deployment history.
