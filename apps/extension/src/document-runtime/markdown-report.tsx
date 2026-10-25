// SPDX-License-Identifier: Apache-2.0

import { useState, type MouseEvent } from "react";
import { PanelIcon } from "./panel-icon";
import { requestMarkdownDownload } from "./markdown-download";
import { formatMarkdownReport, type MarkdownReportInput } from "@ui-torture-lab/engine";

export function MarkdownReport({ report }: { readonly report: MarkdownReportInput }) {
  const markdown = formatMarkdownReport(report);
  const [downloadState, setDownloadState] = useState<{
    readonly markdown: string;
    readonly message: string;
  } | null>(null);

  const download = (event: MouseEvent<HTMLButtonElement>): void => {
    try {
      const container = event.currentTarget.parentElement;
      if (container === null) throw new Error("Report container unavailable");
      requestMarkdownDownload(markdown, container);
      setDownloadState({ markdown, message: "Markdown download requested." });
    } catch {
      setDownloadState({ markdown, message: "Download unavailable. Select the Markdown below and save it as a .md file." });
    }
  };

  return (
    <section aria-label="Markdown Report" className="markdown-report">
      <button className="panel-toggle" onClick={download} type="button">
        <PanelIcon name="download" />Download Report
      </button>
      {downloadState?.markdown === markdown ? <p role="status">{downloadState.message}</p> : null}
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
