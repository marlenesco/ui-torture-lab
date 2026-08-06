// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";
import path from "node:path";
import puppeteer, {
  type Browser,
  type Extension,
  type Page,
} from "puppeteer-core";

test.describe.configure({ mode: "serial" });

let browser: Browser;
let extension: Extension;

const triggerToolbarAction = async (page: Page): Promise<void> => {
  await page.bringToFront();
  await page.triggerExtensionAction(extension);
  await page.waitForSelector("[data-ui-torture-lab-root]", { timeout: 5_000 });
};

const clickPanelButton = async (page: Page, label: string): Promise<void> => {
  await page.waitForFunction(
    (buttonLabel) =>
      [...(
        document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
          ?.querySelectorAll("button") ?? []
      )].some((button) => button.textContent?.trim() === buttonLabel),
    { timeout: 5_000 },
    label,
  );
  await page.evaluate((buttonLabel) => {
    const button = [...(
      document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
        ?.querySelectorAll("button") ?? []
    )].find((candidate) => candidate.textContent?.trim() === buttonLabel);
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Panel button ${buttonLabel} was unavailable`);
    }
    button.click();
  }, label);
};

const readPanelText = (page: Page): Promise<string> =>
  page.evaluate(
    () =>
      document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
        ?.textContent ?? "",
  );

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
  const serviceWorkerTarget = await browser.waitForTarget(
    (target) =>
      target.type() === "service_worker" && target.url().includes(extensionId),
  );
  if ((await serviceWorkerTarget.worker()) === null) {
    throw new Error("Built UI Torture Lab service worker was unavailable");
  }
});

test.afterAll(async () => {
  await browser.close();
});

test("built extension applies, identifies, and restores Unbreakable Text", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/unbreakable-text-run/");
    await triggerToolbarAction(page);
    const original = await page.$eval(
      "#primary-target",
      (target) => target.textContent,
    );

    await clickPanelButton(page, "Apply Unbreakable Text");
    try {
      await page.waitForFunction(
        () =>
          document
            .querySelector("#primary-target")
            ?.textContent?.includes("UTL0123456789") === true,
        { timeout: 5_000 },
      );
    } catch {
      const state = await page.evaluate(() => ({
        panel:
          document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
            ?.textContent ?? "",
        target: document.querySelector("#primary-target")?.textContent ?? "",
      }));
      throw new Error(`Unbreakable Text did not apply: ${JSON.stringify(state)}`);
    }
    const activePanel = await readPanelText(page);
    expect(activePanel).toContain("Unbreakable Text Scenario active");
    expect(activePanel).toContain("8 mutated");

    await clickPanelButton(page, "Restore");
    try {
      await page.waitForFunction(
        () =>
          document.querySelector("#primary-target")?.textContent ===
          "  Checkout now!  ",
        { timeout: 5_000 },
      );
    } catch {
      const state = await page.evaluate(() => ({
        panel:
          document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
            ?.textContent ?? "",
        target: document.querySelector("#primary-target")?.textContent ?? "",
      }));
      throw new Error(`Unbreakable Text did not restore: ${JSON.stringify(state)}`);
    }
    const completedPanel = await readPanelText(page);
    expect(completedPanel).toContain("Unbreakable Text Run completed");
    expect(completedPanel).toContain("Restore completed");
    expect(
      await page.$eval("#primary-target", (target) => target.textContent),
    ).toBe(original);
  } finally {
    if (!page.isClosed()) {
      await page.close();
    }
  }
});

test("built Unbreakable Text Restore leaves an external conflict untouched", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/unbreakable-text-run/");
    await triggerToolbarAction(page);
    await clickPanelButton(page, "Apply Unbreakable Text");
    await page.waitForFunction(
      () =>
        document
          .querySelector("#url-target")
          ?.textContent?.includes("UTL0123456789") === true,
    );
    await page.$eval("#primary-target", (target) => {
      target.textContent = "Developer-owned change";
    });

    await clickPanelButton(page, "Restore");
    await page.waitForFunction(
      () =>
        document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot
          ?.textContent?.includes("Reload required") === true,
    );
    const panelText = await readPanelText(page);
    expect(panelText).toContain("Restore conflict");
    expect(panelText).toContain("External changes were left untouched");
    expect(panelText).not.toContain("Apply Unbreakable Text");
    expect(
      await page.$eval("#primary-target", (target) => target.textContent),
    ).toBe("Developer-owned change");
    expect(await page.$eval("#url-target", (target) => target.textContent)).toBe(
      "https://example.test/orders/42",
    );
  } finally {
    if (!page.isClosed()) {
      await page.close();
    }
  }
});
