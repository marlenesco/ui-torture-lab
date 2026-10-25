// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { rebuildVerifiedRelease } from "./verified-release-build.mjs";
import { inspectReleaseReadiness } from "./release-policy.mjs";

const read = (file) => readFile(file, "utf8");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const contract = JSON.parse(await read("docs/distribution/public-contract.json"));
const gates = JSON.parse(await read("docs/distribution/launch-gates.json"));
const root = JSON.parse(await read("package.json"));
const actualPnpm = execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim();
if (root.packageManager !== `pnpm@${actualPnpm}`) throw new Error("Use the declared pnpm version for an official artifact");
const declaredNode = (await read(".node-version")).trim();
const commit = git("rev-parse", "HEAD");
const { manifest, tag } = await rebuildVerifiedRelease({
  readManifest: async () => JSON.parse(await read("apps/extension/.output/chrome-mv3/manifest.json")),
  validateIdentity(manifest) {
    let tagMatches = false;
    try { tagMatches = git("rev-list", "-n", "1", `v${manifest.version}`) === commit; } catch { /* Missing release tag is a closed gate. */ }
    const errors = inspectReleaseReadiness({ contract, gates, version: manifest.version, clean: git("status", "--porcelain") === "" && git("rev-parse", "HEAD") === commit, node: process.versions.node, declaredNode, siteOrigin: process.env.SITE_URL, tagMatches });
    if (errors.length > 0) throw new Error(errors.join("\n"));
  },
  rebuild() {
    const repository = JSON.parse(execFileSync("gh", ["api", "repos/marlenesco/ui-torture-lab"], { encoding: "utf8" }));
    const branch = JSON.parse(execFileSync("gh", ["api", "repos/marlenesco/ui-torture-lab/branches/main"], { encoding: "utf8" }));
    if (repository.private || !branch.protected || branch.commit.sha !== commit) throw new Error("Official source must be the protected public main commit");
    execFileSync("gh", ["api", `repos/marlenesco/ui-torture-lab/commits/${commit}`], { stdio: "ignore" });
    execFileSync("pnpm", ["check"], { stdio: "inherit" });
  },
});
const files = ["pnpm-lock.yaml"];
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await collect(file); else files.push(file);
  }
}
await collect("apps/extension/.output/chrome-mv3");
await collect("apps/site/dist");
const hashes = Object.fromEntries(await Promise.all(files.sort().map(async (file) => [file, createHash("sha256").update(await readFile(file)).digest("hex")])));
await mkdir(".scratch", { recursive: true });
await writeFile(".scratch/release-record.json", JSON.stringify({ commit, tag, version: manifest.version, node: process.versions.node, pnpm: root.packageManager, buildCommand: "pnpm build", browser: contract.browser, minimumChrome: contract.validatedMinimumChrome, permissions: manifest.permissions, siteOrigin: contract.siteOrigin, storeListing: contract.storeListing, hashes }, null, 2) + "\n");
console.log("Release record written to .scratch/release-record.json. No upload, submission, tag creation, or publication was performed.");
