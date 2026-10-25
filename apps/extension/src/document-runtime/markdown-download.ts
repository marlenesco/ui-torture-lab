// SPDX-License-Identifier: Apache-2.0

export const markdownFilename = "ui-torture-lab-report.md";

/** The container belongs to the Extension UI, keeping the temporary link out of the Target Scope. */
export function requestMarkdownDownload(markdown: string, container: HTMLElement): void {
  const link = container.ownerDocument.createElement("a");
  let url: string | undefined;
  try {
    url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    link.href = url;
    link.download = markdownFilename;
    link.hidden = true;
    container.append(link);
    link.click();
  } finally {
    link.remove();
    // Give Chrome time to consume the local URL, then release the transient Blob resource.
    const objectUrl = url;
    if (objectUrl !== undefined) setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}
