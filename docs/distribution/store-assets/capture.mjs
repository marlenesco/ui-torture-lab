// SPDX-License-Identifier: Apache-2.0
/* global document, chrome */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import puppeteer from "puppeteer-core";

const directory = "docs/distribution/store-assets";
const demo = await readFile(`${directory}/demo.html`);
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const manifest = JSON.parse(await readFile("apps/extension/.output/chrome-mv3/manifest.json", "utf8"));
assert.equal(manifest.version, "1.0.0");
const server = createServer((request, response) => {
  if (request.url !== "/") { response.writeHead(404).end(); return; }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(demo);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await puppeteer.launch({ executablePath: await puppeteer.executablePath("chrome"), headless: true, enableExtensions: true });
  const id = await browser.installExtension(path.resolve("apps/extension/.output/chrome-mv3"));
  const extension = (await browser.extensions()).get(id);
  assert.ok(extension);
  const target = await browser.waitForTarget(target => target.type() === "service_worker" && target.url().startsWith(`chrome-extension://${id}/`));
  const worker = await target.worker();
  assert.ok(worker);
  await worker.evaluate(async () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (chrome.action.onClicked.hasListeners()) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error("Native toolbar receiver unavailable");
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const baseline = await page.$eval("main", element => element.outerHTML);
  await page.bringToFront();
  await page.triggerExtensionAction(extension);
  await page.waitForSelector("[data-ui-torture-lab-root]");
  const click = name => page.locator(`::-p-aria(${name})`).setTimeout(5000).click();
  const waitForText = text => page.waitForFunction(text => document.querySelector("[data-ui-torture-lab-root]")?.shadowRoot?.textContent?.includes(text), { timeout: 5000 }, text);
  const images = [];
  const capture = async (name, state) => {
    const file = `${directory}/${name}.png`;
    await page.screenshot({ path: file });
    const png = await readFile(file);
    assert.equal(png.readUInt32BE(16), 1280);
    assert.equal(png.readUInt32BE(20), 800);
    images.push({ file, state, sha256: createHash("sha256").update(png).digest("hex") });
  };
  await page.locator("::-p-aria(Apply Long Text)").setTimeout(5000).wait();
  await capture("01-authorize", "Authorized, before applying a Scenario");
  await click("Apply Long Text");
  await waitForText("Long Text Scenario active");
  await waitForText("Text Clipping");
  const highlight = await page.waitForSelector('[data-ui-torture-lab-root] >>> button[aria-label^="Highlight Finding Subject"]');
  await highlight.click();
  await capture("02-inspect", "Long Text active, measured Text Clipping Finding and highlighted subject");
  await click("Restore");
  await waitForText("Long Text Run completed");
  assert.equal(await page.$eval("main", element => element.outerHTML), baseline, "Restore recovers the original synthetic interface");
  const downloadButton = await page.waitForSelector("::-p-aria(Download Report)");
  await downloadButton.scrollIntoView();
  await capture("03-report", "Restored, Download Report available, Markdown preview collapsed");
  const hashes = {};
  for (const file of ["manifest.json", "background.js", "document-runtime.js", "THIRD_PARTY_NOTICES.txt"]) hashes[file] = createHash("sha256").update(await readFile(`apps/extension/.output/chrome-mv3/${file}`)).digest("hex");
  await writeFile(`${directory}/capture.json`, JSON.stringify({ sourceCommit, version: manifest.version, browser: await browser.version(), node: process.versions.node, viewport: { width: 1280, height: 800, deviceScaleFactor: 1 }, method: "Built extension in isolated headless Chrome; one native simulated toolbar action and public panel controls; no UI patching or fabricated findings", fixtureSha256: createHash("sha256").update(demo).digest("hex"), restoredExactly: true, hashes, images }, null, 2) + "\n");
  console.log("Captured three 1280×800 screenshots of the built extension; exact synthetic Restore verified.");
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
