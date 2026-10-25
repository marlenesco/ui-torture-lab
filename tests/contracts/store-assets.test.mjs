// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Store screenshot provenance identifies intact images, dimensions and the original synthetic fixture", async () => {
  const directory = "docs/distribution/store-assets";
  const capture = JSON.parse(await readFile(`${directory}/capture.json`, "utf8"));
  const hash = data => createHash("sha256").update(data).digest("hex");
  assert.match(capture.sourceCommit, /^[a-f0-9]{40}$/u);
  assert.equal(capture.restoredExactly, true);
  assert.deepEqual(capture.viewport, { width: 1280, height: 800, deviceScaleFactor: 1 });
  assert.equal(hash(await readFile(`${directory}/demo.html`)), capture.fixtureSha256);
  assert.deepEqual(capture.images.map(image => image.file), ["01-authorize", "02-inspect", "03-report"].map(name => `${directory}/${name}.png`));
  for (const image of capture.images) {
    const bytes = await readFile(image.file);
    assert.equal(hash(bytes), image.sha256, image.file);
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(bytes.readUInt32BE(16), 1280);
    assert.equal(bytes.readUInt32BE(20), 800);
    assert.ok(image.state.length > 0);
  }
  assert.deepEqual(Object.keys(capture.hashes).sort(), ["THIRD_PARTY_NOTICES.txt", "background.js", "document-runtime.js", "manifest.json"]);
  for (const hash of Object.values(capture.hashes)) assert.match(hash, /^[a-f0-9]{64}$/u);
});
