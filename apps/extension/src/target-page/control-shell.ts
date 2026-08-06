// SPDX-License-Identifier: Apache-2.0

import { browser } from "wxt/browser";

export async function mountTargetPageControlShell(
  tabId: number,
  documentId: string,
): Promise<boolean> {
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId, documentIds: [documentId] },
      world: "ISOLATED",
      injectImmediately: true,
      files: ["/document-runtime.js"],
    });

    return (
      injection?.frameId === 0 && injection.documentId === documentId
    );
  } catch {
    return false;
  }
}
