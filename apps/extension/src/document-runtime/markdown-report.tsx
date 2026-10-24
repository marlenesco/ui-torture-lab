// SPDX-License-Identifier: Apache-2.0

import { useState } from "react";
import { formatMarkdownReport, type MarkdownReportInput } from "@ui-torture-lab/engine";

export function MarkdownReport({ report }: { readonly report: MarkdownReportInput }) {
  const markdown = formatMarkdownReport(report);
  const [copyState, setCopyState] = useState<{
    readonly markdown: string;
    readonly message: string;
  } | null>(null);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopyState({ markdown, message: "Markdown copied." });
    } catch {
      setCopyState({ markdown, message: "Clipboard unavailable. Select the Markdown below and copy it manually." });
    }
  };

  return (
    <section aria-label="Markdown Report" className="markdown-report">
      <button className="panel-toggle" onClick={() => { void copy(); }} type="button">
        Copy Report as Markdown
      </button>
      {copyState?.markdown === markdown ? <p role="status">{copyState.message}</p> : null}
      <label>
        Markdown preview
        <textarea
          aria-label="Markdown preview"
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          rows={10}
          spellCheck={false}
          value={markdown}
        />
      </label>
    </section>
  );
}
