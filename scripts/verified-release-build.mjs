// SPDX-License-Identifier: Apache-2.0

/** Never pair pre-build identity with hashes of rebuilt artifacts. */
export async function rebuildVerifiedRelease({ readManifest, validateIdentity, rebuild }) {
  validateIdentity(await readManifest());
  await rebuild();
  const manifest = await readManifest();
  validateIdentity(manifest);
  return { manifest, tag: `v${manifest.version}` };
}
