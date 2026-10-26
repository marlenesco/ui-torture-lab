# Chrome Web Store reviewer instructions

Draft for UI Torture Lab 1.0.0. No product login, account, credentials, paid tier,
remote service or license key is needed. Use current Google Chrome desktop stable
in a normal profile; Incognito and direct file: pages are unsupported.

## Controlled example

1. Use the included public source's synthetic example at
   `docs/distribution/store-assets/demo.html`, served over HTTP. From that directory
   `python3 -m http.server 4173 --bind 127.0.0.1` is sufficient. Open
   `http://127.0.0.1:4173/demo.html`. Stop that server after the review. Any other
   authorized HTTP/HTTPS HTML interface can also be used.
2. Click the extension's Chrome toolbar action on the page. The injected panel
   reports Target Page authorized. A toolbar gesture is required for each new
   Target Page; no persistent host access is requested.
3. Click Apply Long Text. The synthetic plan name has a stable clipping boundary
   and produces a Text Clipping Finding. Read its Baseline/Mutated Evidence, then
   use Highlight subject or Navigate while the Run is active. Possible Cause is
   a hypothesis, not a diagnosis; Findings have no severity score. The plain i icon
   opens the Quick guide; Esc or its × control closes it. Copy locator attempts to
   copy the displayed label on your click, with selection fallback when blocked.
   Labels can match multiple elements; live inspection uses the original element.
4. Click Restore. The original owned text returns. The completed result retains
   Evidence; it does not represent a new page analysis. External changes are
   preserved, with reload-required where cleanup cannot be verified.
5. Click Download Report to request the deterministic UTF-8 `.md` file, suggested
   name `ui-torture-lab-report.md`. The small eye icon reveals the optional Markdown
   preview. Saving and cancellation are controlled by Chrome. No report clipboard write,
   downloads permission or remote upload is involved.
6. Close the panel using its × control; reopen it only using the Chrome toolbar.
   Reload or navigate to end the old page authorization. Returning to a page does
   not silently resume a Run.

## Additional behavior and links

- Long Text, Unbreakable Text and Large Text are the only Scenarios. Detectors are
  Text Clipping, Horizontal Containment Overflow and Viewport Overflow.
- No Findings does not establish page correctness; unsupported or unstable
  comparisons can be inconclusive. Only top-level light DOM is traversed.
- Exactly activeTab, scripting and storage are requested. One reduced, redacted
  result per tab is stored in trusted extension session storage, with deletion
  on tab close; no persistent/synchronized history is created.
- The extension executes only bundled code and makes no application network
  request, telemetry submission or automatic capture.
- Homepage: https://ui-torture-lab.pages.dev/
- Privacy: https://ui-torture-lab.pages.dev/privacy/
- Support: https://ui-torture-lab.pages.dev/support/
- Public source: https://github.com/marlenesco/ui-torture-lab
- Created by Marlenesco: https://github.com/marlenesco

The supplied Store screenshots use the built extension and the same synthetic
interface. Their provenance and automated capture method are recorded in
[store-assets](store-assets/README.md). They do not claim human Product Validation
or Store review/approval.
