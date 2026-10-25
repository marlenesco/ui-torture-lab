# Chrome Web Store screenshots

These three 1280×800 PNGs show the actual built 1.0.0 extension on an original,
synthetic workspace page. Use them in order:

1. `01-authorize.png`: authorized Target Page and the three Scenario actions.
2. `02-inspect.png`: active Long Text, measured Text Clipping Evidence and the
   highlighted boundary. The count and geometry come from the real Engine.
3. `03-report.png`: exact original page content restored, retained Evidence and
   Download Report with its Markdown preview collapsed. The selected diagnostic
   boundary is still highlighted; the screenshot preserves the real UI state.

`capture.json` records the extension source commit, browser, viewport, fixture
hash, extension artifact hashes and screenshot hashes. Capture uses a temporary
headless Chrome profile, a native simulated toolbar action and public panel
controls. It does not patch the extension UI, inject fake Findings, or access a
personal browser profile. This is automated artifact evidence, not a human
platform sign-off, participant observation or a Store-installed validation.

To regenerate from the workspace root, use the declared Node/pnpm versions:

```sh
pnpm build
node docs/distribution/store-assets/capture.mjs
```

The script serves only `demo.html` on a temporary loopback port and closes its
server and browser even on failure. It asserts the 1.0.0 manifest, 1280×800 image
sizes and exact Restore of the synthetic interface. Rebuild the intended source
before capture and review all images after regeneration. Chrome rendering and
measured geometry may vary by version/platform; hashes identify the actual files.
Existing PNGs are committed so ordinary builds and CI do not regenerate them.

The original source is `demo.html`; no customer content, private page, font
download, external asset or account is used. The synthetic Northstar workspace
name is illustrative and is not an endorsement. These materials carry the
repository's Apache-2.0 license and project credits.

Use `apps/extension/public/icons/icon-128.png` as the separate 128×128 Store icon.
Promotional tiles are optional and are not needed for draft creation. Verify the
[current Store listing requirements](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
in the dashboard before submission.
