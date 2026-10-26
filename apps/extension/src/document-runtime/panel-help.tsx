// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from "react";
import { PanelIcon } from "./panel-icon";

export function PanelHelp({ id, onClose }: { readonly id: string; readonly onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeButton.current?.focus(); }, []);

  return (
    <section aria-labelledby={`${id}-title`} className="panel-help" id={id} role="dialog">
      <div className="panel-help-heading">
        <strong id={`${id}-title`}>Quick guide</strong>
        <button aria-label="Close quick guide" className="panel-plain-button" onClick={onClose} ref={closeButton} title="Close guide (Esc)" type="button">
          <PanelIcon name="close" plain />
        </button>
      </div>
      <dl>
        <dt>Apply a Scenario</dt>
        <dd>Large Text enlarges text; Long Text repeats it; Unbreakable Text adds a long token. Inspect one Scenario at a time.</dd>
        <dt>Highlight subject</dt>
        <dd>Scroll to and outline the responsible boundary, or the Primary Contributor for Viewport Overflow.</dd>
        <dt>Highlight ranges / Navigate</dt>
        <dd>Ranges reveals the first affected text and outlines its ranges. Navigate scrolls to the subject without adding an outline.</dd>
        <dt>Copy locator</dt>
        <dd>Copy the displayed diagnostic label as a search hint in DevTools or context in a bug report. A label such as <code>div</code> can match multiple elements; it is not guaranteed to be a unique selector. Highlight and Navigate use the original live element.</dd>
        <dt>Restore / Close</dt>
        <dd>Restore reverses owned changes and clears outlines. Collapse minimizes the panel; Close hides it. Both keep the Run active. Reopen a closed panel with the browser toolbar.</dd>
        <dt>Download Report</dt>
        <dd>When a Run ends, save a local Markdown file. The eye icon previews it. Review sensitive context before sharing. Clear saved result deletes a previous snapshot, not downloaded files.</dd>
      </dl>
      <p>Possible Cause is a hypothesis. No Findings does not prove correctness; check inconclusive coverage too.</p>
    </section>
  );
}
