// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";
import type { Extension, Page, WebWorker } from "puppeteer-core";

async function background(page: Page): Promise<WebWorker> {
  const target = await page.browser().waitForTarget((candidate) => candidate.type() === "service_worker" && candidate.url().startsWith("chrome-extension://"), { timeout: 5000 });
  const worker = await target.worker();
  if (worker === null) throw new Error("Extension toolbar receiver is unavailable");
  return worker;
}

/** Observe the native receiver before a simulated action; never retry the authorization action. */
export async function triggerFixtureAction(page: Page, extension: Extension): Promise<void> {
  await test.step("Observe ready native toolbar receiver", async () => {
    const worker = await background(page);
    await expect.poll(() => worker.evaluate("chrome.action.onClicked.hasListeners()"), { timeout: 5000 }).toBe(true);
    await worker.evaluate(`(() => {
      const key = Symbol.for("ui-torture-lab/test-authorization-trace");
      if (globalThis[key]) return;
      const trace = globalThis[key] = { clicked: [], calls: [] };
      chrome.action.onClicked.addListener(tab => {
        trace.clicked.push({tabId: tab.id, hasUrl: typeof tab.url === "string"});
        if (trace.clicked.length > 8) trace.clicked.shift();
      });
      const execute = chrome.scripting.executeScript.bind(chrome.scripting);
      chrome.scripting.executeScript = async details => {
        const record = {target: details.target, world: details.world, files: details.files, state: "pending"};
        trace.calls.push(record);
        if (trace.calls.length > 32) trace.calls.shift();
        try {
          const results = await execute(details);
          record.state = "completed";
          record.results = results.map(({documentId, frameId, result}) => ({
            documentId, frameId, resultType: typeof result,
            status: typeof result === "object" && result !== null ? result.status : ["mounted", "failed", "reload-required"].includes(result) ? result : undefined,
            reason: typeof result === "object" && result !== null ? result.reason : undefined
          }));
          return results;
        } catch (error) { record.state = "failed"; record.error = String(error); throw error; }
      };
    })()`);
  });
  await test.step("Dispatch one native toolbar action", () => page.triggerExtensionAction(extension), { timeout: 5000 });
}

export async function attachAuthorizationTrace(page: Page): Promise<void> {
  try {
    const worker = await background(page);
    const trace = await worker.evaluate('JSON.stringify(globalThis[Symbol.for("ui-torture-lab/test-authorization-trace")] ?? null, null, 2)');
    await test.info().attach("native-authorization-trace", { body: String(trace), contentType: "application/json" });
  } catch { /* A terminated renderer or worker may no longer provide diagnostics. */ }
}
