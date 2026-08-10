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

test("built extension applies Large Text through exact Restore", async () => {
  const page = await browser.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/large-text-run/");
    await triggerToolbarAction(page);
    const original = await page.$eval("#inline-target", (target) => {
      if (!(target instanceof HTMLElement)) {
        throw new Error("Inline target was unavailable");
      }
      return {
        priority: target.style.getPropertyPriority("font-size"),
        value: target.style.getPropertyValue("font-size"),
      };
    });

    await clickPanelButton(page, "Apply Large Text");
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector("#primary-target")!).fontSize ===
        "40px",
      { timeout: 5_000 },
    );
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-ui-torture-lab-root]")
          ?.shadowRoot?.textContent?.includes("Large Text Scenario active") === true,
      { timeout: 5_000 },
    );
    const activePanel = await readPanelText(page);
    expect(activePanel).toContain("Large Text Scenario active");
    expect(activePanel).toContain("5 mutated");

    await clickPanelButton(page, "Restore");
    await page.waitForFunction(
      () => {
        const target = document.querySelector("#inline-target");
        return (
          target instanceof HTMLElement &&
          target.style.getPropertyValue("font-size") === "15px" &&
          target.style.getPropertyPriority("font-size") === ""
        );
      },
      { timeout: 5_000 },
    );
    const completedPanel = await readPanelText(page);
    expect(completedPanel).toContain("Large Text Run completed");
    expect(completedPanel).toContain("Restore completed");
    expect(await page.$eval("#inline-target", (target) => {
      if (!(target instanceof HTMLElement)) {
        throw new Error("Inline target was unavailable");
      }
      return {
        priority: target.style.getPropertyPriority("font-size"),
        value: target.style.getPropertyValue("font-size"),
      };
    })).toEqual(original);
  } finally {
    if (!page.isClosed()) {
      await page.close();
    }
  }
});
