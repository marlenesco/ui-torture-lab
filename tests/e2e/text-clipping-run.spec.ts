// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";
import { waitForExtensionPanel } from "../support/extension-panel";
import path from "node:path";
import { executeAsyncInIsolated } from "../support/extension-script";
import puppeteer, {
  type Browser,
  type Extension,
  type WebWorker,
} from "puppeteer-core";

test.describe.configure({ mode: "serial" });

let browser: Browser;
let extension: Extension;
let serviceWorker: WebWorker;

test.beforeAll(async () => {
  browser = await puppeteer.launch({
    executablePath: await puppeteer.executablePath("chrome"),
    headless: true,
    enableExtensions: true,
  });
  const extensionId = await browser.installExtension(
    path.resolve("apps/extension/.output/chrome-mv3"),
  );
  const installedExtension = (await browser.extensions()).get(extensionId);
  if (installedExtension === undefined) {
    throw new Error("Built UI Torture Lab extension was not installed");
  }
  extension = installedExtension;
  const target = await browser.waitForTarget(
    (candidate) =>
      candidate.type() === "service_worker" && candidate.url().includes(extensionId),
  );
  const worker = await target.worker();
  if (worker === null) {
    throw new Error("Built UI Torture Lab service worker was unavailable");
  }
  serviceWorker = worker;
});

test.afterAll(async () => {
  await browser.close();
});

test("built extension groups the completed Finding under Text Clipping", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/text-clipping-run/");
    await page.bringToFront();
    await page.triggerExtensionAction(extension);
    await waitForExtensionPanel(page);
    const panelText = () => page.evaluate(() => document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.textContent ?? "");
    await test.step("Apply Long Text through the built panel", async () => {
      await page.locator("::-p-aria(Apply Long Text)").setTimeout(5000).click();
      await expect.poll(panelText).toContain("Long Text Scenario active");
    });
    expect(await panelText()).toContain("Text Clipping");
    expect(await panelText()).toContain("Boundary p#clipping-boundary");
    await test.step("Restore through the built panel and retain grouped Evidence", async () => {
      await page.locator("::-p-aria(Restore)").setTimeout(5000).click();
      await expect.poll(panelText).toContain("Run completed");
      expect(await panelText()).toContain("Text Clipping");
      expect(await panelText()).toContain("Boundary p#clipping-boundary");
    });
  } finally {
    await page.close();
  }
});

test("built extension inspects a live Finding without rematching a disconnected Subject", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/text-clipping-run/");
    await page.bringToFront();
    await page.triggerExtensionAction(extension);
    await waitForExtensionPanel(page);

    await page.evaluate(() => {
      const button = [...(
        document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
          ?.querySelectorAll("button") ?? []
      )].find(
        (candidate) => candidate.textContent?.trim() === "Apply Long Text",
      );
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error("Long Text control was unavailable");
      }
      button.click();
    });

    try {
      await page.waitForFunction(
        () =>
          document
            .querySelector("[data-ui-torture-lab-root]")
            ?.shadowRoot?.textContent?.includes("Finding detail") === true,
        { timeout: 5_000 },
      );
    } catch {
      const state = await page.evaluate(() => ({
        panel:
          document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
            ?.textContent ?? "",
        target: document.querySelector("#clipping-boundary")?.textContent ?? "",
      }));
      throw new Error(`Finding detail was unavailable: ${JSON.stringify(state)}`);
    }

    const detail = await page.evaluate(
      () =>
        document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
          ?.textContent ?? "",
    );
    expect(detail).toContain("Evidence");
    expect(detail).toContain("Computed CSS");
    expect(detail).toContain("Possible Cause");

    await page.evaluate(() => {
      const button = document
        .querySelector("[data-ui-torture-lab-root]")
        ?.shadowRoot?.querySelector<HTMLButtonElement>(
          '[aria-label="Highlight Finding Subject p#clipping-boundary"]',
        );
      if (button === null || button === undefined) {
        throw new Error("Finding highlight control was unavailable");
      }
      button.click();
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-ui-torture-lab-overlay-root]")
          ?.shadowRoot?.querySelector(
            '[data-ui-torture-lab-highlight][data-ui-torture-lab-highlight-kind="subject"]',
          ) !== null,
    );

    await page.evaluate(() => {
      document.querySelector("[data-ui-torture-lab-overlay-root]")?.remove();
      document
        .querySelector("[data-ui-torture-lab-root]")
        ?.shadowRoot?.querySelector<HTMLButtonElement>(
          '[aria-label="Highlight Finding Subject p#clipping-boundary"]',
        )
        ?.click();
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-ui-torture-lab-overlay-root]")
          ?.shadowRoot?.querySelector(
            '[data-ui-torture-lab-highlight][data-ui-torture-lab-highlight-kind="subject"]',
          ) !== null,
    );

    await page.evaluate(() => {
      document
        .querySelector("[data-ui-torture-lab-root]")
        ?.shadowRoot?.querySelector<HTMLButtonElement>(
          '[aria-label="Copy diagnostic locator p#clipping-boundary"]',
        )
        ?.click();
    });
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
      "p#clipping-boundary",
    );

    await page.evaluate(() => {
      document.querySelector("#clipping-boundary")?.remove();
      document
        .querySelector("[data-ui-torture-lab-root]")
        ?.shadowRoot?.querySelector<HTMLButtonElement>(
          '[aria-label="Highlight Finding Subject p#clipping-boundary"]',
        )
        ?.click();
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-ui-torture-lab-root]")
          ?.shadowRoot?.textContent?.includes(
            "Live Finding reference is no longer available.",
          ) === true,
    );
    expect(
      await page.$eval(
        '[data-ui-torture-lab-root]',
        (host) =>
          host.shadowRoot?.querySelector<HTMLButtonElement>(
            '[aria-label="Highlight Finding Subject p#clipping-boundary"]',
          )?.disabled,
      ),
    ).toBe(true);
  } finally {
    await page.close();
  }
});

test("built extension shows containment and Viewport Overflow from Unbreakable Text", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/horizontal-containment-run/");
    await page.bringToFront();
    await page.triggerExtensionAction(extension);
    await waitForExtensionPanel(page);
    await executeAsyncInIsolated(serviceWorker, async () => {
          type Controller = { startScenario(scenarioId: "unbreakable-text"): Promise<void> };
          const runtime = (globalThis as typeof globalThis & {
            [key: symbol]: { readonly runController?: Controller } | undefined;
          })[Symbol.for("ui-torture-lab/document-runtime")];
          if (runtime?.runController === undefined) throw new Error("Run Controller was unavailable");
          await runtime.runController.startScenario("unbreakable-text");
        });
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-ui-torture-lab-root]")
          ?.shadowRoot?.textContent?.includes("Unbreakable Text Scenario active") ===
        true,
      { timeout: 5_000 },
    );
    const panelText = await page.evaluate(
      () => document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.textContent ?? "",
    );
    expect(panelText).toContain("Findings");
    expect(panelText).toContain("Boundary div#containing-boundary");
    expect(panelText).toContain("Target Page");
    expect(panelText).toContain("via p#viewport-child");
    expect(panelText).toContain("Contributors: inline-end p#viewport-child");
    expect(panelText).toContain("baseline");
    expect(panelText).toContain("delta");
    expect(panelText).toContain("extends the Target Page beyond its layout viewport");
  } finally {
    await page.close();
  }
});
