// SPDX-License-Identifier: Apache-2.0

import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const extension = path.join(root, "apps/extension");
const wxt = await realpath(path.join(extension, "node_modules/wxt"));
const reactDom = await realpath(path.join(extension, "node_modules/react-dom"));
const directories = [
  path.join(extension, "node_modules/react"), reactDom,
  path.join(reactDom, "../scheduler"), wxt, path.join(wxt, "../@wxt-dev/browser"),
];
const sections = await Promise.all(directories.map(async (directory) => {
  const manifest = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
  let license;
  for (const filename of ["LICENSE", "LICENSE.md", "LICENSE.txt"]) {
    try { license = await readFile(path.join(directory, filename), "utf8"); break; } catch { /* Try the package's next standard license filename. */ }
  }
  // The published WXT and browser tarballs declare MIT but omit their license file.
  if (license === undefined && ["wxt", "@wxt-dev/browser"].includes(manifest.name)) {
    license = await readFile(path.join(root, "docs/distribution/licenses/wxt-MIT.txt"), "utf8");
  }
  if (license === undefined) throw new Error(`Missing license text for ${manifest.name}@${manifest.version}`);
  return `${manifest.name}@${manifest.version} (${manifest.license})\n\n${license.trim()}`;
}));
const notice = await readFile(path.join(root, "NOTICE"), "utf8");
const license = await readFile(path.join(root, "LICENSE"), "utf8");
await writeFile(path.join(extension, ".output/chrome-mv3/THIRD_PARTY_NOTICES.txt"),
  notice.trim() + "\n\n" + license.trim() + "\n\n---\n\nUI Torture Lab — third-party distribution notices\n\nIncludes runtime dependencies and WXT adapter code incorporated during build.\n\n" + sections.join("\n\n---\n\n") + "\n");
