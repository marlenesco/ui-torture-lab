# Panel action guide and explicit locator copy

The manual launch session identified unclear inspection actions and the misleading
selection-only locator control. The panel now offers a plain information icon
with a titled, nonmodal Quick guide. It explains Scenarios, boundaries and ranges,
locator ambiguity, Restore, collapse/close, report preview/download and saved-result
cleanup. Escape and the guide close control return focus to the information icon.
The guide remains inside extension-owned measurement-safe UI.

Copy locator attempts only the displayed label on a trusted active user gesture,
without a new extension permission or clipboard read. Successful writes receive
explicit feedback; rejected or missing access selects the clicked Finding's own
code node for manual copying, even when multiple Findings share the same label.
Reports continue to download as deterministic Markdown. ADR-0033 and public
contract schema 3 record the added locator capability and its limits.

Validation on macOS/Chrome 155: pnpm check passed lint, types, production builds,
97 contract tests, 189 E2E tests and artifact policy checks. New native UI tests
cover keyboard/focus behavior, 320px layout, identical Finding Evidence with the
guide open or closed, collapse/close cleanup, trusted versus synthetic clicks,
copy feedback and duplicate-label fallback. Clipboard tests mock only the native
write boundary in the extension's ISOLATED world; they neither read nor modify
the operating-system clipboard and do not constitute manual permission sign-off.

Technical Validation in issue #26 remains pending. Native manual copying, guide
usability and the remaining macOS/Windows/Linux checklist require the selected
candidate to be reloaded and explicitly tested. Earlier ZIPs remain superseded;
no Store upload or publication is performed by this change.
