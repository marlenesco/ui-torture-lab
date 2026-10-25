// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inspectPngIcon } from "../../scripts/release-policy.mjs";

const sizes = [16, 32, 48, 128];
const hash = data => createHash("sha256").update(data).digest("hex");

test("Chrome uses the isolated green mark at every declared PNG icon size", async () => {
  const manifest = JSON.parse(await readFile("apps/extension/.output/chrome-mv3/manifest.json", "utf8"));
  const expected = Object.fromEntries(sizes.map(size => [size, `icons/icon-${size}.png`]));
  assert.deepEqual(manifest.icons, expected);
  assert.deepEqual(manifest.action.default_icon, expected);
  for (const size of sizes) {
    const data = await readFile(`apps/extension/.output/chrome-mv3/icons/icon-${size}.png`);
    assert.equal(data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(data.readUInt32BE(16), size);
    assert.equal(data.readUInt32BE(20), size);
    assert.equal(data[25], 6, "icons retain an alpha channel");
  }
});

test("brand derivatives remain tied to the provided source and preserve the complete green group", async () => {
  const manifest = JSON.parse(await readFile("assets/branding/generated.json", "utf8"));
  const original = await readFile("assets/branding/ui-torture-lab.svg");
  assert.equal(hash(original), manifest.sourceSha256);
  for (const [file, digest] of Object.entries(manifest.files)) assert.equal(hash(await readFile(file)), digest, file);
  const icon = await readFile("assets/branding/icon.svg", "utf8");
  assert.equal([...icon.matchAll(/<rect\b/gu)].length, 3, "green tile and both original white bars");
  assert.equal([...icon.matchAll(/<path\b/gu)].length, 3, "all three burst wedges");
  assert.equal([...icon.matchAll(/rotate\(-10\)/gu)].length, 3);
  assert.doesNotMatch(icon, /#4f4f4f|<script|<image|href=|onload=/iu);
  const full = await readFile("apps/site/src/assets/brand-logo.svg", "utf8");
  assert.ok(full.includes("#4f4f4f"));
  assert.equal([...full.matchAll(/<path\b/gu)].length, 4, "complete mark includes the original outline");
});

test("icon guard rejects truncated, substituted, incorrectly sized or opaque artifacts", async () => {
  const original = await readFile("apps/extension/public/icons/icon-32.png");
  assert.deepEqual(inspectPngIcon(original, 32), []);
  assert.ok(inspectPngIcon(original.subarray(0, 12), 32).length > 0);
  const replaced = Buffer.from(original); replaced[0] = 0;
  assert.ok(inspectPngIcon(replaced, 32).length > 0);
  assert.ok(inspectPngIcon(original, 48).length > 0);
  const opaque = Buffer.from(original); opaque[25] = 2;
  assert.ok(inspectPngIcon(opaque, 32).length > 0);
});
