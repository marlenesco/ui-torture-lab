// SPDX-License-Identifier: Apache-2.0

import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import puppeteer, { type Page } from "puppeteer-core";

type Geometry = {
  readonly bodyScrollWidth: number;
  readonly breakpoint: string;
  readonly clientWidth: number;
  readonly documentScrollWidth: number;
  readonly innerWidth: number;
  readonly outerWidth: number;
  readonly resizeCount: number;
};

const fixtureUrl =
  "http://127.0.0.1:4173/extension-ui-contamination/";

const readGeometry = async (page: Page): Promise<Geometry> =>
  page.evaluate(() => {
    const breakpointState = document.querySelector("#breakpoint-state");
    if (breakpointState === null) {
      throw new Error("Controlled fixture breakpoint state was unavailable");
    }
    return {
      bodyScrollWidth: document.body.scrollWidth,
      breakpoint: getComputedStyle(breakpointState, "::after").content,
      clientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      outerWidth: window.outerWidth,
      resizeCount: (window as typeof window & { fixtureResizeCount: number })
        .fixtureResizeCount,
    };
  });

const waitForStableViewport = async (page: Page): Promise<void> => {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        let previousWidth = window.innerWidth;
        let stableFrames = 0;
        let sampledFrames = 0;
        const sample = (): void => {
          sampledFrames += 1;
          if (window.innerWidth === previousWidth) {
            stableFrames += 1;
          } else {
            stableFrames = 0;
            previousWidth = window.innerWidth;
          }
          if (stableFrames >= 8) {
            resolve();
          } else if (sampledFrames >= 180) {
            reject(new Error("Chrome viewport did not stabilize"));
          } else {
            requestAnimationFrame(sample);
          }
        };
        requestAnimationFrame(sample);
      }),
  );
};

test("Chrome Side Panel changes the controlled layout viewport", async () => {
  const browser = await puppeteer.launch({
    executablePath: await puppeteer.executablePath("chrome"),
    headless: true,
    enableExtensions: true,
    defaultViewport: null,
    args: ["--window-size=900,700"],
  });

  try {
    const extensionId = await browser.installExtension(
      path.resolve("tests/benchmarks/ui-surface-side-panel"),
    );
    const extension = (await browser.extensions()).get(extensionId);
    if (extension === undefined) {
      throw new Error("Side Panel benchmark extension was not installed");
    }
    const serviceWorkerTarget = await browser.waitForTarget(
      (target) =>
        target.type() === "service_worker" && target.url().includes(extensionId),
    );
    const serviceWorker = await serviceWorkerTarget.worker();
    if (serviceWorker === null) {
      throw new Error("Side Panel benchmark service worker was unavailable");
    }
    await serviceWorker.evaluate(async () => {
      await (globalThis as typeof globalThis & {
        sidePanelReady: Promise<void>;
      }).sidePanelReady;
    });

    const page = await browser.newPage();
    await page.goto(fixtureUrl);
    const before = await readGeometry(page);

    await page.triggerExtensionAction(extension);
    await page.waitForFunction(
      () => {
        const breakpointState = document.querySelector("#breakpoint-state");
        return (
          breakpointState !== null &&
          window.innerWidth < 700 &&
          getComputedStyle(breakpointState, "::after").content === '"narrow"'
        );
      },
    );
    await waitForStableViewport(page);
    const opened = await readGeometry(page);

    expect(
      browser.targets().some((target) =>
        target.url().endsWith("/sidepanel.html"),
      ),
    ).toBe(true);

    expect(before).toMatchObject({
      breakpoint: '"wide"',
      clientWidth: 900,
      innerWidth: 900,
      outerWidth: 900,
      resizeCount: 0,
    });
    expect(opened.innerWidth).toBeLessThan(before.innerWidth);
    expect(opened.clientWidth).toBeLessThan(before.clientWidth);
    expect(opened.documentScrollWidth).toBeLessThan(
      before.documentScrollWidth,
    );
    expect(opened.bodyScrollWidth).toBeLessThan(before.bodyScrollWidth);
    expect(opened.outerWidth).toBe(before.outerWidth);
    expect(opened.resizeCount).toBeGreaterThan(0);
    expect(opened.breakpoint).toBe('"narrow"');

    await page.reload();
    await waitForStableViewport(page);
    const reloaded = await readGeometry(page);
    expect(reloaded).toMatchObject({
      bodyScrollWidth: opened.bodyScrollWidth,
      breakpoint: opened.breakpoint,
      clientWidth: opened.clientWidth,
      documentScrollWidth: opened.documentScrollWidth,
      innerWidth: opened.innerWidth,
      outerWidth: opened.outerWidth,
    });

    await page.goto("http://127.0.0.1:4173/smoke/");
    expect(await page.evaluate(() => window.innerWidth)).toBe(opened.innerWidth);
    expect(
      browser.targets().filter((target) =>
        target.url().endsWith("/sidepanel.html"),
      ),
    ).toHaveLength(1);

    const manifest = JSON.parse(
      await readFile(
        "tests/benchmarks/ui-surface-side-panel/manifest.json",
        "utf8",
      ),
    ) as { readonly permissions?: readonly string[] };
    expect(manifest.permissions).toContain("sidePanel");
  } finally {
    await browser.close();
  }
});
