// SPDX-License-Identifier: Apache-2.0

import { browser } from "wxt/browser";

export async function mountTargetPageControlShell(
  tabId: number,
  documentId: string,
  grantId: string,
): Promise<"mounted" | "reload-required" | "failed"> {
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId, documentIds: [documentId] },
      world: "ISOLATED",
      injectImmediately: true,
      files: ["/document-runtime.js"],
    });

    if (injection?.frameId !== 0 || injection.documentId !== documentId) return "failed";
    const [authorization] = await browser.scripting.executeScript({
      target: { tabId, documentIds: [documentId] }, world: "ISOLATED",
      args: [grantId],
      func: async (grantId: string) => {
        const runtime = (globalThis as typeof globalThis & {
          [key: symbol]: { authorize(grant: string): Promise<"mounted" | "reload-required" | "failed"> } | undefined;
        })[Symbol.for("ui-torture-lab/document-runtime")];
        return runtime === undefined ? "failed" : await runtime.authorize(grantId);
      },
    });
    return authorization?.frameId === 0 && authorization.documentId === documentId &&
      (authorization.result === "mounted" || authorization.result === "reload-required")
      ? authorization.result : "failed";
  } catch {
    return "failed";
  }
}
