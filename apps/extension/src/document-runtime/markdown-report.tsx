// SPDX-License-Identifier: Apache-2.0

import { useId, useState, type MouseEvent } from "react";
import { PanelIcon } from "./panel-icon";
import { requestMarkdownDownload } from "./markdown-download";
import { formatMarkdownReport, type MarkdownReportInput } from "@ui-torture-lab/engine";

export function MarkdownReport({ report }: { readonly report: MarkdownReportInput }) {
  const markdown = formatMarkdownReport(report);
  const previewId = useId();
  const [previewOpen, setPreviewOpen] = useState(false);
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
      setPreviewOpen(true);
      setDownloadState({ markdown, message: "Download unavailable. Select the Markdown below and save it as a .md file." });
    }
  };

  return (
    <section aria-label="Markdown Report" className="markdown-report">
      <div className="markdown-actions">
        <button className="panel-toggle" onClick={download} type="button">
          <PanelIcon name="download" />Download Report
        </button>
        <button
          aria-controls={previewId}
          aria-expanded={previewOpen}
          aria-label={previewOpen ? "Hide Markdown preview" : "Show Markdown preview"}
          className="markdown-preview-toggle"
          onClick={() => setPreviewOpen(open => !open)}
          title={previewOpen ? "Hide Markdown preview" : "Show Markdown preview"}
          type="button"
        >
          <PanelIcon name="preview" plain />
        </button>
      </div>
      {downloadState?.markdown === markdown ? <p role="status">{downloadState.message}</p> : null}
      <label hidden={!previewOpen} id={previewId}>
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
