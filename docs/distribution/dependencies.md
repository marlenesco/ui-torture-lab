# Dependency and asset review

Review scope: 1.0.0 candidate, 2026-10-25. No dependency version was added or upgraded by the navigation, lifecycle, documentation, or guardrail implementation.

## Shipped runtime

| Material | Pinned version | License | Distribution treatment |
| --- | --- | --- | --- |
| React | 19.2.8 | MIT | Full installed license in extension THIRD_PARTY_NOTICES.txt |
| React DOM | 19.2.8 | MIT | Full installed license and explicit renderer-function review |
| Scheduler | 0.27.0 | MIT | Full installed license in extension notices |
| WXT generated adapter code | 0.21.3 | MIT | Full upstream MIT license in extension notices |
| @wxt-dev/browser wrapper | 0.2.5 | MIT | Same upstream project MIT license in extension notices |
| Engine | workspace source | Apache-2.0 | Original repository source; no runtime package dependencies |
| Website | static HTML/CSS and inline SVG | Apache-2.0 | Original authored content, synthetic illustration and owner-supplied logo; no runtime JS, external fonts, remote assets, or embeds |

`pnpm licenses list --prod --json` confirms React, React DOM, and Scheduler as the package production dependency graph. WXT and its browser wrapper are build dependencies whose generated wrapper code is incorporated into the extension, so their notices are also included. Dependencies retain their own terms; the monorepo license does not replace them.

The installed WXT/browser tarballs declare MIT but omit license files. The fallback `licenses/wxt-MIT.txt` is the exact [upstream LICENSE at wxt-v0.21.3](https://github.com/wxt-dev/wxt/blob/wxt-v0.21.3/LICENSE), Git blob `5d1a7c76daa510b00a6a04079aed9cc6b98502b4`. The build performs no license download. A contract test verifies that pinned upstream text.

## Renderer exception

React DOM includes three hoistable script-resource helper functions even though the application never renders scripts or imports React DOM resource APIs. These are dormant bundled library capabilities, not an application network path. The artifact gate approves only the complete reviewed enclosing function fingerprints in `reviewed-renderer.json`; properties, literals, and control flow are preserved while minified identifier spelling is normalized. A changed function or additional occurrence fails. First-party script creation, executable JSX, page bridges, and resource API imports remain rejected. This exception is not a general allowlist for script injection or remote code.

## Build-time supply chain

Astro 7.1.6 compiles the static site; WXT 0.21.3/Vite 8.2.0 compile the extension; TypeScript 6.0.3 checks strict types. Playwright 1.62.1 and Puppeteer Core 25.5.0 are test-only. Node and pnpm are declared in `.node-version`, `package.json`, and the versioned lockfile. All direct versions are exact; the workspace has no additional runtime packages or task runner.

Only esbuild and sharp dependency build scripts are permitted by `pnpm-workspace.yaml`. The sole workspace postinstall is `wxt prepare`, which generates local extension types. Frozen installation is mandatory in CI and reconstruction. GitHub Actions dependencies are pinned by full commit; the failure-evidence uploader retains only synthetic test artifacts for seven days, with screenshot recording disabled.

All fixture pages, documentation, CSS, and illustrations are original synthetic project material. The project owner supplied both official SVG logo variants; their unchanged originals, generated transparent PNG application icons and derivative hashes are recorded in `assets/branding/`. The README and website credit Marlenesco; the extension ships the original NOTICE, Apache-2.0 license and third-party notices together. No production HTML, real report, proprietary code, participant data, private asset or uncertain-origin image was imported. The artifact/source scanner rejects common credential formats and private network URLs. These tripwires complement code and provenance review; they do not prove absence of every possible secret or personal datum. Every new dependency, asset, remote request, or vendor exception requires an explicit review and matching public-contract update before release.
