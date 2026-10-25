// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import test from "node:test";
import { rebuildVerifiedRelease } from "../../scripts/verified-release-build.mjs";

test("release identity uses the rebuilt manifest rather than stale generated metadata", async () => {
  let generated = { version: "1.0.0", permissions: ["activeTab"] };
  const validated = [];
  const result = await rebuildVerifiedRelease({
    readManifest: async () => generated,
    validateIdentity: (manifest) => validated.push(manifest.version),
    rebuild: async () => { generated = { version: "2.0.0", permissions: ["activeTab", "scripting", "storage"] }; },
  });
  assert.deepEqual(validated, ["1.0.0", "2.0.0"]);
  assert.deepEqual(result, { manifest: generated, tag: "v2.0.0" });
});

test("a rebuild that changes identity to an untagged artifact cannot produce a release record", async () => {
  let generated = { version: "1.0.0" };
  await assert.rejects(rebuildVerifiedRelease({
    readManifest: async () => generated,
    validateIdentity: (manifest) => { if (manifest.version !== "1.0.0") throw new Error("Release tag does not identify the rebuilt version"); },
    rebuild: async () => { generated = { version: "2.0.0" }; },
  }), /Release tag does not identify the rebuilt version/u);
});

test("failed preflight skips rebuilding and a failed build cannot return a release identity", async () => {
  let builds = 0;
  await assert.rejects(rebuildVerifiedRelease({
    readManifest: async () => ({ version: "0.0.0" }),
    validateIdentity: () => { throw new Error("Pending launch gates"); },
    rebuild: async () => { builds++; },
  }), /Pending launch gates/u);
  assert.equal(builds, 0);
  await assert.rejects(rebuildVerifiedRelease({
    readManifest: async () => ({ version: "1.0.0" }), validateIdentity: () => undefined,
    rebuild: async () => { throw new Error("Artifact gate rejected"); },
  }), /Artifact gate rejected/u);
});
