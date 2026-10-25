# Chrome Web Store draft field guide

Prepared for the 1.0.0 candidate on 2026-10-26. These are draft materials, not a
record of dashboard entry, owner certification, Google review or publication.
Developer registration remains pending according to the owner.

## Listing and distribution

| Dashboard field | Prepared value or action |
| --- | --- |
| Name | UI Torture Lab, from manifest |
| Version | 1.0.0, from manifest |
| Manifest description | Deterministic text stress testing for measurable layout regressions. |
| Detailed description | Copy the Detailed description section in [canonical Store copy](chrome-web-store.md), including the Marlenesco credit and repository URL |
| Language | English |
| Category | Select the developer-tools category offered by the current dashboard |
| Homepage | https://ui-torture-lab.pages.dev/ |
| Privacy policy | https://ui-torture-lab.pages.dev/privacy/ |
| Support | https://ui-torture-lab.pages.dev/support/ |
| Publisher credit | Marlenesco, subject to the owner's actual publisher-profile configuration; no account identity or address is invented |
| Store icon | `apps/extension/public/icons/icon-128.png` |
| Screenshots | `store-assets/01-authorize.png`, `02-inspect.png`, `03-report.png` |
| Price | Free |
| Audience and regions | Owner selection in the Distribution tab |
| Reviewer instructions | [reviewer-instructions.md](reviewer-instructions.md); no login required |
| Publication timing | Prefer deferred publication so the approved listing can receive its final check before becoming available |

Do not describe the candidate as already published. The listing identity remains
null until an actual draft item exists. Complete manual Technical Validation and
freeze the packaged runtime before the first 1.0.0 upload; replacement uploads
require a newer version, so do not rely on re-uploading modified 1.0.0 bytes. Save its item ID and canonical URL before
updating `public-contract.json`; do not use a guessed URL.

## Privacy practices — prepared text

Single purpose:

> Locally apply deterministic text stress to a developer-authorized web interface
> and report supported geometric regressions with before/after Evidence.

Permission justifications:

- **activeTab:** temporary access after the user's toolbar action on the current
  Target Page. No persistent host access; Page Exit and observed same-document
  navigation end product authorization.
- **scripting:** inject the bundled Engine and detachable panel into the authorized
  top-level HTML Document's ISOLATED world. No MAIN-world helper, page script bridge
  or remote executable code.
- **storage:** retain one reduced, validated, redacted result per tab in
  trusted-context-only chrome.storage.session. No permanent/synchronized history
  or Target Page storage. Closing the tab removes its stored result.

Remote code: **No, I am not using remote code.** All executable extension code is
bundled locally; the application has no remote code fetch or execution path.

Data-practice facts to use when completing the actual questionnaire:

| Data or operation | Actual behavior |
| --- | --- |
| Page content | DOM, eligible text, computed CSS and geometry are processed locally after a toolbar gesture |
| Temporary original values | Kept in memory for conflict-aware Restore and released at Run end |
| Session result | Numeric Evidence, diagnostic Locators, short redacted excerpts, origin and pathname; query/fragment omitted; one reduced result per tab |
| External transmission | No extension application network request, project-server upload, telemetry, advertising or sale of result data |
| Export | Explicit local Markdown download only; its user-managed file survives extension retention cleanup |
| Hidden collection/capture | No automatic screenshot, form-value export, full-text serialization or hidden export fields |

The owner must review the dashboard's current data-category definitions and
certify the actual practices. Do not infer that every data checkbox is false
merely because processing stays local. In particular, page content and reduced
page-address metadata are accessed; arbitrary authorized pages can contain
sensitive context and redaction is not an anonymity guarantee. Review the exact
form wording before selecting categories. The canonical privacy and Store copy
describe these facts consistently.

## Owner-only account steps

Choose the publishing Google account, complete registration and any required
one-time payment, enable 2-Step Verification, and complete the requested public
publisher/contact/identity fields in the dashboard. Do not place passwords,
verification codes, payment details or private contact information in this repo.
Public contact details should be supplied deliberately by the owner. Website
ownership verification is a separate step if the owner wants a verified official
URL badge; it does not follow from deploying the Pages site.

Sources checked for these draft steps: [registration](https://developer.chrome.com/docs/webstore/register),
[listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing),
[privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy),
[2-Step Verification](https://developer.chrome.com/docs/webstore/program-policies/two-step-verification)
and [submission/publication](https://developer.chrome.com/docs/webstore/publish).
