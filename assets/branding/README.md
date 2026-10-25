# UI Torture Lab brand assets

`ui-torture-lab.svg` is the original vector supplied by the project owner. Keep it as the source of truth. The full mark is used inline in the Extension UI and website header; a dark backing on the website preserves its white detail. The isolated original `Layer_4` group is the application mark: tilted lime tile, both white bars and all three burst wedges.

Run `pnpm brand:generate` with the repository's Node/pnpm versions and installed Chrome. The existing Puppeteer dependency renders transparent PNGs without adding an image service or runtime dependency. The generator accepts only the original geometric SVG elements and paint attributes, removes editor metadata, crops transparent margins without changing geometry, and creates:

- `apps/site/src/assets/brand-logo.svg`: full inline website logo, in the existing site build-watch scope.
- `apps/extension/src/document-runtime/brand-logo.tsx`: generated inline React geometry, avoiding page-CSP image dependencies or exposed extension assets.
- `icon.svg` and `apps/site/public/favicon.svg`: isolated green application mark.
- `apps/extension/public/icons/icon-{16,32,48,128}.png`: Chrome manifest and toolbar icons.
- `generated.json`: source and derivative hashes checked by the contract suite and artifact gate.

Commit source and generated files together. PNGs are checked in so normal builds do not need to regenerate them; rendering may vary between Chrome/platform versions. Full SVG geometry and transforms remain unchanged. The logo adds no permission, remote asset, tracking, script or application network client.
