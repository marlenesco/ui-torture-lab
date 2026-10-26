# Chrome Web Store publication checklist

Updated on 2026-10-26 for the **1.0.0 candidate**. Assigning a version, building a
ZIP, or uploading a draft is separate from publishing the Official Distribution.
The owner reported that developer registration remains pending. No Store upload,
submission, public tag, or release is recorded by this checklist. Keep the website's
pre-release notice until the Store item is actually available.

## Candidate prepared in this repository

- All workspace packages and the Chrome manifest use 1.0.0. WXT reads the
  extension package version directly.
- Full official logos have light- and dark-background variants. The application
  icon retains the green tilted tile, both white bars and all three burst wedges.
- The website footer and README link the repository and credit
  [Marlenesco](https://github.com/marlenesco). The packaged notices include the
  original credits and Apache-2.0 license.
- [Store copy](chrome-web-store.md), permission justifications and privacy
  disclosures are prepared. The actual Store questionnaire still needs completion.
- Website: https://ui-torture-lab.pages.dev/; privacy:
  https://ui-torture-lab.pages.dev/privacy/; support:
  https://ui-torture-lab.pages.dev/support/.

After `pnpm check` passes with the declared Node/pnpm versions, create a local
candidate ZIP with a standard ZIP utility:

```sh
mkdir -p .scratch
(cd apps/extension/.output/chrome-mv3 && zip -X -r ../../../../.scratch/ui-torture-lab-1.0.0-candidate.zip .)
```

Start with a new archive; do not reuse an older ZIP that could retain stale files.
The ZIP root must contain manifest.json, background.js, document-runtime.js,
THIRD_PARTY_NOTICES.txt and icons/icon-{16,32,48,128}.png. Exclude source files,
development bundles, credentials and the website. This candidate is for inspection
and draft preparation. Complete manual Technical Validation and freeze the runtime
before its first Store upload. After recording the draft identity, the final
protected source/tag must reproduce every packaged file byte-for-byte; preserve
the exact uploaded ZIP and its hash with the final release evidence.

## Remaining release gates

- [ ] Merge the inspection-highlight correction and retest the selected corrected
  artifact with the real toolbar. Earlier draft ZIPs are superseded; use the
  updated [manual preparation](../validation/manual-platform-smoke.md) and
  [recovery record](../validation/inspection-highlight-recovery.md).
- [ ] Complete and record the remaining installed-extension/manual Chrome stable
  checks on macOS, Windows and Linux in
  [issue #26](https://github.com/marlenesco/ui-torture-lab/issues/26).
- [x] Complete [Product Validation, issue #28](https://github.com/marlenesco/ui-torture-lab/issues/28)
  using the owner's explicitly adopted six-profile agent criterion. The
  [simulation report](../validation/product/2026-10-26-simulated-review.md) records
  six scoped passes and no confirmed unresolved blocker; actual human usability
  remains unverified. Technical Validation is not waived.
- [x] Enable and verify main branch protection. PRs, the GitHub Actions `verify`
  check, current base, linear history and resolved conversations are required,
  including for administrators; force pushes and deletion are blocked. Independent
  approvals are not required for the solo-maintainer workflow. See the
  [2026-10-26 read-back record](../validation/records/2026-10-26-main-protection.json).
- [x] Merge PR #51 as `7b579c0`, verify [main CI](https://github.com/marlenesco/ui-torture-lab/actions/runs/40243082548)
  and production Pages deployment `1893f62f-821b-471d-b9e3-ba8d4788e91a`.
  The built-extension screenshot capture additionally verifies one native toolbar
  authorization, a live Text Clipping Finding and exact synthetic Restore. This
  automated check does not clear manual platform validation.
- [ ] Obtain the real Store item identity from a draft; record the canonical URL
  in `public-contract.json` without claiming public availability.
- [ ] Record actual passing launch gates with evidence, create the intentional
  `v1.0.0` tag on the final protected public main commit, and follow
  [release verification](release.md) to generate the final release record.

Do not mark pending checks passed or bypass `create-release-record.mjs`. Track
publication and final installed-artifact validation in
[issue #29](https://github.com/marlenesco/ui-torture-lab/issues/29).

## Publisher and listing steps

1. Choose the Google account that will own the extension. Register in the
   [developer dashboard](https://chrome.google.com/webstore/devconsole), accept
   the agreement and pay the one-time registration fee if required. Complete the
   account/contact or identity fields the dashboard requests. These steps require
   the owner's account and decisions. See [registration](https://developer.chrome.com/docs/webstore/register).
2. Enable [2-Step Verification](https://developer.chrome.com/docs/webstore/program-policies/two-step-verification),
   required before publishing or updating. Review the public publisher name and
   contact details. Chrome [ignores manifest `author`](https://developer.chrome.com/docs/extensions/reference/manifest/author);
   configure the public publisher credit in the dashboard.
3. After Technical Validation and runtime freeze, add a new item and upload the
   frozen 1.0.0 ZIP as a draft. Record its real item ID and listing URL. Uploading
   a draft is separate from submitting for review.
   See [publishing](https://developer.chrome.com/docs/webstore/publish).
4. Fill the listing from the canonical copy: title, description, English language,
   appropriate developer-tool category, homepage and support links. Preserve the
   Marlenesco credit and repository URL. Supply the 128×128 PNG icon and at least
   one actual 1280×800 screenshot (up to five) showing the final extension on
   synthetic fixtures. A 440×280 small promo tile and 1400×560 marquee are optional.
   Review icon spacing and legibility on light and dark surfaces before upload.
   See [listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
   and [image guidance](https://developer.chrome.com/docs/webstore/images).
5. Complete the [Privacy practices](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
   tab: single purpose, minimum permission justifications, local page-data
   processing, session retention, explicit Markdown downloads and the privacy URL.
   Zero transmission to a project server does not mean no local data processing.
6. Choose free distribution, audience and regions; add reviewer instructions for
   toolbar authorization, applying one Scenario, inspecting a Finding, Restore
   and Download Report. No product login or credentials are needed.
7. Record the real draft identity in a reviewed metadata change and create the
   final protected source/tag/release record. Verify that its packaged files equal
   the already uploaded frozen ZIP. After all release gates pass, submit that
   draft for review and choose publication timing. Deferred publication allows a final check after
   approval. Once live, install from the canonical listing, run the installed-build
   smoke checks, publish source/tag/hash/release notes and update availability on
   the website. Approval and review timing are controlled by Google.

Three actual 1280×800 screenshots and their reproducible capture/provenance are
prepared in [store-assets](store-assets/README.md). The 128×128 icon is already
available in `apps/extension/public/icons/icon-128.png`; optional promotional
graphics are not required to create a draft. Publisher registration, questionnaire
completion, the real Store item identity, review submission and the final
Store-installed smoke check remain open. [Reviewer instructions](reviewer-instructions.md)
and [draft field guidance](store-fields.md) are prepared for the dashboard.

## Package version sequencing

The Store requires an increased manifest version when uploading a replacement
package. Do not plan a provisional 1.0.0 upload followed by a different 1.0.0
package. Finish manual checks and freeze the extension first; obtain the draft
identity with that exact ZIP, then record the URL and final source/tag using
metadata changes that preserve every packaged byte. Keep the first-upload ZIP
and compare it against the final verified build. If a packaged file changes after
upload, follow the Store's version-increment rules before replacement; do not
claim the original uploaded artifact represents the changed runtime. See
[package updates](https://developer.chrome.com/docs/webstore/update) and
[the upload API](https://developer.chrome.com/docs/webstore/using-api).
