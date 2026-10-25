// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { triggerFixtureAction } from "../support/extension-action";

test("a fresh isolated extension context refuses orphan UI until the page reloads", async () => {
  const copy = await mkdtemp(path.join(tmpdir(), "ui-torture-runtime-"));
  const browser = await puppeteer.launch({ executablePath: await puppeteer.executablePath("chrome"), headless: true, enableExtensions: true });
  try {
    const artifact = path.resolve("apps/extension/.output/chrome-mv3");
    await cp(artifact, copy, { recursive: true });
    const firstId = await browser.installExtension(artifact);
    const first = (await browser.extensions()).get(firstId);
    if (first === undefined) throw new Error("First extension context unavailable");
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:4173/page-exit/");
    await page.bringToFront();
    const text = () => page.evaluate(() => document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.textContent ?? "");
    await triggerFixtureAction(page, first);
    await expect.poll(text).toContain("Apply Long Text");
    await browser.uninstallExtension(firstId);
    await expect.poll(text).toContain("Extension connection lost");

    // A distinct native extension ID gives a fresh ISOLATED context while retaining the actual orphan DOM.
    const nextId = await browser.installExtension(copy);
    expect(nextId).not.toBe(firstId);
    const next = (await browser.extensions()).get(nextId);
    if (next === undefined) throw new Error("Fresh extension context unavailable");
    await triggerFixtureAction(page, next);
    const workerTarget = await browser.waitForTarget(target => target.type() === "service_worker" && target.url().includes(nextId));
    const worker = await workerTarget.worker();
    if (worker === null) throw new Error("Fresh worker unavailable");
    await expect.poll(() => worker.evaluate(async () => {
      const api = (globalThis as unknown as { chrome: { tabs: { query(details: object): Promise<{ id: number }[]> }; action: { getTitle(details: { tabId: number }): Promise<string> } } }).chrome;
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      if (tab === undefined) throw new Error("Active fixture tab unavailable");
      return api.action.getTitle({ tabId: tab.id });
    })).toContain("Reload the page");
    expect(await page.$$("[data-ui-torture-lab-root]")).toHaveLength(1);
    expect(await page.$$("[data-ui-torture-lab-overlay-root]")).toHaveLength(1);
    expect(await page.$eval("#boundary", node => node.textContent)).toBe("Checkout");

    await page.reload();
    await triggerFixtureAction(page, next);
    await expect.poll(text).toContain("Apply Long Text");
    expect(await page.$$("[data-ui-torture-lab-root]")).toHaveLength(1);
    await page.locator("::-p-aria(Apply Long Text)").setTimeout(5000).click();
    await expect.poll(text).toContain("Long Text Scenario active");
    await page.locator("::-p-aria(Restore)").setTimeout(5000).click();
    expect(await page.$eval("#boundary", node => node.textContent)).toBe("Checkout");
  } finally {
    await browser.close();
    await rm(copy, { recursive: true, force: true });
  }
});

test("Scenario controls wait for the current grant acknowledgement", async () => {
  const browser = await puppeteer.launch({ executablePath: await puppeteer.executablePath("chrome"), headless: true, enableExtensions: true });
  try {
    const id = await browser.installExtension(path.resolve("apps/extension/.output/chrome-mv3"));
    const extension = (await browser.extensions()).get(id);
    if (extension === undefined) throw new Error("Extension unavailable");
    const target = await browser.waitForTarget(candidate => candidate.type() === "service_worker" && candidate.url().includes(id));
    const worker = await target.worker();
    if (worker === null) throw new Error("Worker unavailable");
    await expect.poll(() => worker.evaluate("chrome.runtime.onConnect.hasListeners()")).toBe(true);
    // Delay only the native port's acknowledgement, without changing production timing or authorization.
    await worker.evaluate(`chrome.runtime.onConnect.addListener(port => {
      const send = port.postMessage.bind(port);
      port.postMessage = message => {
        if (message.type !== "grant-bound") return send(message);
        globalThis.releaseGrantAcknowledgement = () => send(message);
        send({...message, grantId: "stale-grant"});
      };
    })`);
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:4173/page-exit/");
    await page.bringToFront();
    await triggerFixtureAction(page, extension);
    await expect.poll(() => worker.evaluate("typeof globalThis.releaseGrantAcknowledgement")).toBe("function");
    const controls = () => page.evaluate(() => [...(document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
      .filter(button => button.textContent?.startsWith("Apply ")).map(button => button.disabled));
    await expect.poll(controls).toEqual([true, true, true]);
    expect(await page.$eval("#boundary", node => node.textContent)).toBe("Checkout");
    await worker.evaluate("globalThis.releaseGrantAcknowledgement()");
    await expect.poll(controls).toEqual([false, false, false]);
    await page.locator("::-p-aria(Apply Long Text)").setTimeout(5000).click();
    await expect.poll(() => page.evaluate(() => document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.textContent)).toContain("Long Text Scenario active");
    await page.locator("::-p-aria(Restore)").setTimeout(5000).click();
    expect(await page.$eval("#boundary", node => node.textContent)).toBe("Checkout");
  } finally { await browser.close(); }
});
