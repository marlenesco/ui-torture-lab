// SPDX-License-Identifier: Apache-2.0

import { expect } from "@playwright/test";
import type { WebWorker } from "puppeteer-core";

/** Starts work in ISOLATED, then collects its result through bounded synchronous injections. */
export async function executeAsyncInIsolated<T, Args extends unknown[]>(worker: WebWorker, work: (...args: Args) => Promise<T>, ...args: Args): Promise<T> {
  const key = `ui-torture-lab/test-task/${crypto.randomUUID()}`;
  const tabId = await worker.evaluate(async () => {
    const api = (globalThis as unknown as { chrome: { tabs: { query(query: object): Promise<{ id?: number }[]> } } }).chrome;
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) throw new Error("No active fixture tab");
    return tab.id;
  });
  await worker.evaluate(`chrome.scripting.executeScript({
    target: { tabId: ${tabId}, frameIds: [0] }, world: "ISOLATED",
    func: () => {
      const key = Symbol.for(${JSON.stringify(key)});
      globalThis[key] = { status: "pending" };
      const work = ${work.toString()};
      void work(...${JSON.stringify(args)}).then(
        (value) => { globalThis[key] = { status: "completed", value }; },
        (error) => { globalThis[key] = { status: "failed", error: String(error) }; }
      );
    }
  })`);
  type Result = { status: "pending" | "completed" | "failed"; value?: T; error?: string };
  let result: Result | undefined;
  try {
    await expect.poll(async () => {
      const injections = await worker.evaluate(`chrome.scripting.executeScript({
        target: { tabId: ${tabId}, frameIds: [0] }, world: "ISOLATED",
        func: () => globalThis[Symbol.for(${JSON.stringify(key)})]
      })`) as { result?: Result }[];
      result = injections[0]?.result;
      return result?.status;
    }).toMatch(/^(completed|failed)$/u);
    const settled = result as Result | undefined;
    if (settled?.status !== "completed") throw new Error(settled?.error ?? "ISOLATED fixture work did not complete");
    return settled.value as T;
  } finally {
    await worker.evaluate(`chrome.scripting.executeScript({
      target: { tabId: ${tabId}, frameIds: [0] }, world: "ISOLATED",
      func: () => { delete globalThis[Symbol.for(${JSON.stringify(key)})]; }
    })`).catch(() => undefined);
  }
}
