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
  assert.equal("content_scripts" in manifest, false);
  assert.equal("side_panel" in manifest, false);
  assert.equal("default_popup" in manifest.action, false);
  assert.match(manifest.background.service_worker, /\.js$/u);
});

test("built extension contains no MAIN-world or page bridge path", async () => {
  const artifacts = await Promise.all(
    ["background.js", "document-runtime.js"].map((file) =>
      readFile(`apps/extension/.output/chrome-mv3/${file}`, "utf8"),
    ),
  );

  for (const artifact of artifacts) {
    assert.doesNotMatch(artifact, /world:["'`]MAIN["'`]/u);
    assert.doesNotMatch(artifact, /window\.postMessage/u);
    assert.doesNotMatch(artifact, /new CustomEvent/u);
  }

  const targetPageSources = await Promise.all(
    [
      "apps/extension/src/document-runtime/runtime.tsx",
      "apps/extension/src/entrypoints/document-runtime.tsx",
      "apps/extension/src/target-page/control-shell.ts",
    ].map((file) => readFile(file, "utf8")),
  );
  for (const source of targetPageSources) {
    assert.doesNotMatch(source, /window\.postMessage/u);
    assert.doesNotMatch(source, /new CustomEvent/u);
    assert.doesNotMatch(source, /createElement\(["'`]script["'`]\)/u);
  }
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
