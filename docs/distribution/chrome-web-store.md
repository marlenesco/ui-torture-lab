# Chrome Web Store canonical copy

Status: pre-release draft for the 1.0.0 candidate. The official website is deployed at https://ui-torture-lab.pages.dev and the privacy URL is https://ui-torture-lab.pages.dev/privacy/. The Store listing remains null in `public-contract.json`; publisher-account readiness has not been verified. No Store publication is claimed. Follow [the publication checklist](publication.md), complete the remaining validation, and record the actual listing identity and public source before publication. Do not submit placeholder URLs.

## Name

UI Torture Lab

## Short description

Stress text on your own web interface. Inspect measured layout regressions, Restore, and download the Evidence as Markdown.

## Detailed description

UI Torture Lab helps frontend developers expose and investigate layout regressions on an interface they own or can modify.

Open a top-level HTTP or HTTPS HTML page in Google Chrome desktop stable, including localhost. Click the toolbar action and choose one Scenario: Long Text, Unbreakable Text, or Large Text. Read comparable Baseline and Mutated Evidence from Text Clipping, Horizontal Containment Overflow, and Viewport Overflow. Inspect a live Finding Subject or Primary Contributor, Restore, then use Download Report to save the visible deterministic Markdown as a .md file. Initiation failure leaves a selectable preview for manual saving.

A Finding requires a new or measurably worsened supported regression on the same connected element. No Findings does not prove that the page is correct. Unstable or unsupported comparisons are inconclusive. Possible Cause is a hypothesis. Findings have no severity or global quality score. This is not accessibility auditing, visual regression, behavioral testing, or cross-browser testing.

The supported browser is current Google Chrome desktop stable on macOS, Windows, and Linux using Manifest V3. Only the top-level light DOM is traversed; iframe documents and Shadow DOM are excluded. Incognito is not allowed. Direct file:, data:, blob:, protected browser pages, built-in viewers, non-HTML documents, mobile, other browsers, and non-stable channels are unsupported. Serve local files through localhost.

Mutations remain active until explicit Restore or a lifecycle/safety boundary. Restore preserves external changes; conflicts or unverified cleanup require a true reload. Page Exit and observed same-document navigation revoke authorization. Returning from BFCache never resumes a Run. Restore before private SPA transitions without an observable entry change, or before SPA route changes when observation is incomplete. Abrupt runtime termination can prevent cleanup or final result delivery.

The Official Distribution's MVP is free. No account, registration, key, subscription, payment, advertising, usage limit, entitlement, or gated feature is required. The local workflow remains usable offline from project services on an already available page. Support is best-effort for the latest Official Distribution in Supported Scope, with no SLA or application-code consulting. Modified builds have no official support guarantee.

Created by Marlenesco: https://github.com/marlenesco.

Original code is Apache-2.0 in the complete public repository: https://github.com/marlenesco/ui-torture-lab. Third-party licenses remain applicable; branding and official endorsement are separate from the code license. Official releases identify their public source commit, tag, manifest version, build environment, lockfile, artifact, and release notes.

## Single purpose

Locally apply deterministic text stress to a developer-authorized web interface and report supported geometric regressions with before/after Evidence.

## Permission justification

- `activeTab`: temporary access following an explicit toolbar action on the current Target Page, with no persistent host access. Product authorization ends at Page Exit or observed same-document navigation.
- `scripting`: inject the Engine and detachable UI only into the authorized top-level HTML Document's ISOLATED world. No MAIN-world helper, script-element injection, page bridge, or History monkey patch.
- `storage`: retain one latest reduced, validated, redacted result per tab in trusted-context-only chrome.storage.session. No full-text serialization, permanent or synchronized history, or Target Page storage.

No host permissions, persistent content-script matches, tabs, webNavigation, clipboardWrite, downloads, debugger, cookies, history, webRequest, or network interception permissions. Limited tab lifecycle APIs do not require the broad tabs permission. No application network client, telemetry, remote code, automatic screenshot, or hidden export.

## Privacy disclosure

Local DOM, eligible text, CSS, and geometry analysis begins only after the toolbar action. Complete original values needed for Restore temporarily remain in in-memory Active Run State and are released at Run end. One reduced result per tab can contain numeric Evidence, diagnostic Locators, short redacted previews, origin, and pathname; query strings and fragments are excluded. A later completed Run replaces it. After authorization ends it becomes a non-live Previous-Target Snapshot. Clear saved result deletes a previous snapshot; reload and reopen the toolbar to expose that control for a completed current result. Tab close deletes the stored result; browser session storage is not durable history.

The extension makes no Run network request, takes no automatic screenshot, retains no serialized full page text, and transmits no result to a project server. Download Report is the report export: an explicit local UTF-8 .md download with suggested filename ui-torture-lab-report.md. Its bytes equal the visible preview when expanded, without a new page read. The preview starts collapsed and is toggled by a plain eye icon. It uses a local Blob URL without downloads/clipboardWrite permissions or clipboard writes; initiation failures open selectable Markdown for manual saving. The browser controls save completion, cancellation, destination and duplicate names. Downloaded files are user-managed copies outside extension retention; clearing a result, closing a tab or ending the session does not delete them. No automatic download, JSON, rich HTML, screenshot, hidden content or remote export is provided. The page and browser may make their own requests. Redaction cannot guarantee anonymity: review origin, pathname, Locators, short excerpts, and context before sharing.

Copy locator separately attempts to copy only the displayed diagnostic label on your explicit click, without an additional extension permission or clipboard read. Blocked or unavailable access selects the label for manual copying. Ordinary HTTP pages lack the required secure context and use this fallback. A label such as div may match multiple elements and is not guaranteed to be a unique selector; Highlight and Navigate use the original live element. Clipboard copies are user-managed outside extension retention. The plain i icon opens an offline Quick guide to the panel actions.

The static website uses no analytics, tracking, third-party fonts, embeds, forms, accounts, advertising, or non-essential cookies. Hosting, Chrome Web Store, GitHub, and browsers apply their own policies.

For a suspected vulnerability, use GitHub Private Vulnerability Reporting: https://github.com/marlenesco/ui-torture-lab/security/advisories/new. Do not post sensitive reports publicly.

When completing Store questionnaire fields, classify local processing and session retention according to the current questionnaire definitions. Do not describe the extension as reading no page data, claim absolute safety, claim published availability before approval, or equate zero server transmission with zero local processing.
