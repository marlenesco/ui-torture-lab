# UI Torture Lab brand assets

The official full logo has two original vectors supplied by the project owner: `ui-torture-lab-light.svg` for light backgrounds and `ui-torture-lab.svg` for dark backgrounds. Keep both unchanged as the sources of truth. The website uses the light-background variant directly on its page surface, without a dark backing. The dark Extension UI uses the original white-detail variant. The README selects the corresponding variant for the reader's color scheme. The isolated original `Layer_4` group is the application mark: tilted lime tile, both white bars and all three burst wedges.

The approved light-background accent is **#769C1F (variant A)**. Generation replaces only the original lime fills on the tilted tile and three burst wedges in the light-background derivatives; both white bars, other fills and all geometry remain unchanged. The original supplied files are preserved. Dark-background and application-icon derivatives retain **#D7F36B**. `generated.json` records the selected light accent alongside source and derivative hashes.

Run `pnpm brand:generate` with the repository's Node/pnpm versions and installed Chrome. The existing Puppeteer dependency renders transparent PNGs without adding an image service or runtime dependency. The generator accepts only the original geometric SVG elements and paint attributes, removes editor metadata, crops transparent margins without changing geometry, and creates:

- `logo-light.svg` and `logo-dark.svg`: cropped, transparent full logos for the corresponding background, used by the README.
- `apps/site/src/assets/brand-logo.svg`: full light-background inline website logo, in the existing site build-watch scope.
- `apps/extension/src/document-runtime/brand-logo.tsx`: generated inline React geometry, avoiding page-CSP image dependencies or exposed extension assets.
- `icon.svg` and `apps/site/public/favicon.svg`: isolated green application mark.
- `apps/extension/public/icons/icon-{16,32,48,128}.png`: Chrome manifest and toolbar icons.
- `generated.json`: source and derivative hashes checked by the contract suite and artifact gate.

Commit source and generated files together. PNGs are checked in so normal builds do not need to regenerate them; rendering may vary between Chrome/platform versions. Full SVG geometry and transforms remain unchanged. The logo adds no permission, remote asset, tracking, script or application network client.
