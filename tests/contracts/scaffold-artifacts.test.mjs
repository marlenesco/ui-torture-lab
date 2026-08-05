// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { pathToFileURL } from "node:url";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

test("workspace builds the loadable Chrome MV3 scaffold", async () => {
  const manifest = await readJson(
    "apps/extension/.output/chrome-mv3/manifest.json",
  );

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, "UI Torture Lab");
  assert.equal(manifest.incognito, "not_allowed");
  assert.deepEqual([...manifest.permissions].sort(), [
    "activeTab",
    "scripting",
    "storage",
  ]);
  assert.equal("host_permissions" in manifest, false);
  assert.match(manifest.background.service_worker, /\.js$/u);
});

test("workspace builds a portable static website scaffold", async () => {
  const html = await readFile("apps/site/dist/index.html", "utf8");

  assert.match(html, /<title>UI Torture Lab<\/title>/u);
  assert.match(html, /<h1(?:\s[^>]*)?>UI Torture Lab<\/h1>/u);
  assert.doesNotMatch(html, /<script(?:\s|>)/u);
});

test("Engine build is importable and has no application dependencies", async () => {
  await import(
    pathToFileURL("packages/engine/dist/index.js").href + `?t=${Date.now()}`
  );

  const extensionPackage = await readJson("apps/extension/package.json");
  const enginePackage = await readJson("packages/engine/package.json");

  assert.equal(
    extensionPackage.dependencies["@ui-torture-lab/engine"],
    "workspace:*",
  );
  assert.deepEqual(enginePackage.dependencies ?? {}, {});
});
