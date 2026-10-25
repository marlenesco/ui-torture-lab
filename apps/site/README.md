# Static product website

Astro compiles original English product documentation to portable files in `dist/`. Essential content and navigation work without JavaScript. The site has no hydration, client state, forms, third-party assets, fonts, telemetry, cookies, backend, or hosting adapter.

```sh
pnpm --filter @ui-torture-lab/site build
pnpm --filter @ui-torture-lab/site typecheck
python3 -m http.server 4321 --directory apps/site/dist
```

Run the server from the workspace root and stop it when the smoke check ends. `SITE_URL` sets the canonical origin at build time; local builds default to `http://localhost:4321`. A release must supply the actual official HTTPS origin. No public domain or Chrome Web Store listing is invented while publication is pending.

Required routes: `/`, `/docs/`, `/scope/`, `/install/`. The install route states release status and explains source-based development installation. It must link the actual official listing only after publication is verified.

Contract tests inspect generated HTML, canonical paths, heading structure, internal links, supported capabilities, and lifecycle language. Browser smoke tests disable JavaScript, follow keyboard navigation, check visible focus and skip links, and exercise 360/800/1280px viewports with reduced motion. The fixture server mounts the unchanged generated output at `/__site__/`; the test harness maps root-relative requests to that mount without changing the artifact.

Design: a typographic field manual, one accent, synthetic clipping illustration, native disclosures, CSS entrance and link transitions with reduced-motion overrides. No external asset provenance is needed; all visuals are original HTML and CSS.
