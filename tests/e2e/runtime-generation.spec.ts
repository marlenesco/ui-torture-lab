// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { triggerFixtureAction } from "../support/extension-action";

for (const surface of ["visible", "closed"] as const) {
  test(`a fresh isolated extension context refuses ${surface} orphan controls until the page reloads`, async () => {
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
      if (surface === "closed") {
        await page.locator("::-p-aria(Apply Long Text)").setTimeout(5000).click();
        await expect.poll(text).toContain("Long Text Scenario active");
        await page.locator("::-p-aria(Close UI Torture Lab)").setTimeout(5000).click();
        await expect.poll(() => page.$$("[data-ui-torture-lab-root]").then(nodes => nodes.length)).toBe(0);
      }
      const boundaryBeforeReplacement = await page.$eval("#boundary", node => node.textContent);
      await browser.uninstallExtension(firstId);
      if (surface === "visible") await expect.poll(text).toContain("Extension connection lost");

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
      expect(await page.$$("[data-ui-torture-lab-root]")).toHaveLength(surface === "visible" ? 1 : 0);
      expect(await page.$$("[data-ui-torture-lab-overlay-root]")).toHaveLength(surface === "visible" ? 1 : 0);
      expect(await page.$eval("#boundary", node => node.textContent)).toBe(boundaryBeforeReplacement);

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
}

test("Scenario controls show an unavailable state until the current grant acknowledgement", async () => {
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
    const appearance = () => page.evaluate(() => [...(document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
      .filter(button => button.textContent?.startsWith("Apply ")).map(button => {
        const style = getComputedStyle(button);
        const icon = button.querySelector("svg");
        const panel = button.closest(".panel-shell");
        if (icon === null || panel === null) throw new Error("Icon action unavailable");
        const iconStyle = getComputedStyle(icon);
        return { background: style.backgroundColor, color: style.color, border: style.borderTopStyle, cursor: style.cursor,
          iconBackground: iconStyle.backgroundColor, iconInk: iconStyle.stroke, panelBackground: getComputedStyle(panel).backgroundColor };
      }));
    const disabledAppearance = await appearance();
    expect(disabledAppearance).toHaveLength(3);
    for (const style of disabledAppearance) {
      expect(style.cursor).toBe("not-allowed");
      expect(style.border).toBe("none");
      expect(style.background).toBe("rgba(0, 0, 0, 0)");
      expect(style.iconBackground).not.toBe("rgba(0, 0, 0, 0)");
      expect(style.iconInk).toBe(style.panelBackground);
    }
    await page.screenshot({ path: test.info().outputPath("panel-disabled.png") });
    expect(await page.$eval("#boundary", node => node.textContent)).toBe("Checkout");
    await page.locator("::-p-aria(Close UI Torture Lab)").setTimeout(5000).click();
    await expect.poll(() => page.$$("[data-ui-torture-lab-root]").then(nodes => nodes.length)).toBe(0);
    await worker.evaluate("globalThis.releaseGrantAcknowledgement()");
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(await page.$$("[data-ui-torture-lab-root], [data-ui-torture-lab-overlay-root]")).toHaveLength(0);
    await triggerFixtureAction(page, extension);
    await expect.poll(controls).toEqual([true, true, true]);
    await worker.evaluate("globalThis.releaseGrantAcknowledgement()");
    await expect.poll(controls).toEqual([false, false, false]);
    await expect.poll(async () => (await appearance()).map((style, index) =>
      style.color !== disabledAppearance[index]?.color,
    )).toEqual([true, true, true]);
    const enabledAppearance = await appearance();
    for (const [index, style] of enabledAppearance.entries()) {
      expect(style.cursor).toBe("pointer");
      expect(style.border).toBe("none");
      expect(style.background).toBe("rgba(0, 0, 0, 0)");
      expect(style.iconBackground).not.toBe("rgba(0, 0, 0, 0)");
      expect(style.iconInk).toBe(style.panelBackground);
      expect(style.color).not.toBe(disabledAppearance[index]?.color);
      expect(style.iconBackground).not.toBe(disabledAppearance[index]?.iconBackground);
    }
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    expect(await page.$eval("[data-ui-torture-lab-root]", host => {
      const button = host.shadowRoot?.querySelector(".panel-action");
      if (button === null || button === undefined) throw new Error("Scenario control unavailable");
      return getComputedStyle(button).transitionDuration;
    })).toBe("0s");
    await page.screenshot({ path: test.info().outputPath("panel-enabled.png") });
    let keyboardFocus: { style: string; width: string } | null = null;
    for (let attempt = 0; attempt < 8 && keyboardFocus === null; attempt += 1) {
      await page.keyboard.press("Tab");
      keyboardFocus = await page.evaluate(() => {
        const active = document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.activeElement;
        if (!(active instanceof HTMLButtonElement)) return null;
        const style = getComputedStyle(active);
        return { style: style.outlineStyle, width: style.outlineWidth };
      });
    }
    expect(keyboardFocus).toEqual({ style: "solid", width: "2px" });
    await page.locator("::-p-aria(Apply Long Text)").setTimeout(5000).click();
    await expect.poll(() => page.evaluate(() => document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.textContent)).toContain("Long Text Scenario active");
    await page.screenshot({ path: test.info().outputPath("panel-findings.png") });
    await page.locator("::-p-aria(Restore)").setTimeout(5000).click();
    expect(await page.$eval("#boundary", node => node.textContent)).toBe("Checkout");
  } finally { await browser.close(); }
});
