// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { inspectJavaScript, inspectManifest, inspectProvenance, inspectSiteFile } from "./release-policy.mjs";

const errors = [];
const read = (file) => readFile(file, "utf8");
const report = (file, messages) => errors.push(...messages.map((message) => `${file}: ${message}`));
const renderer = JSON.parse(await read("docs/distribution/reviewed-renderer.json"));
const contract = JSON.parse(await read("docs/distribution/public-contract.json"));
const extensionRoot = "apps/extension/.output/chrome-mv3";
const manifest = JSON.parse(await read(`${extensionRoot}/manifest.json`));
report(`${extensionRoot}/manifest.json`, inspectManifest(manifest, contract));
for (const file of await readdir(extensionRoot)) {
  if (!["manifest.json", "background.js", "document-runtime.js", "THIRD_PARTY_NOTICES.txt"].includes(file)) report(`${extensionRoot}/${file}`, ["unreviewed extension artifact"]);
  const code = await read(`${extensionRoot}/${file}`);
  if (file.endsWith(".js")) report(`${extensionRoot}/${file}`, inspectJavaScript(code, { requireInjection: file === "background.js", reviewedScriptCreators: file === "document-runtime.js" ? renderer.scriptCreators : [] }));
  report(`${extensionRoot}/${file}`, inspectProvenance(code));
}
const notices = await read(`${extensionRoot}/THIRD_PARTY_NOTICES.txt`);
for (const dependency of ["react@19.2.8", "react-dom@19.2.8", "scheduler@0.27.0", "wxt@0.21.3", "@wxt-dev/browser@0.2.5"]) if (!notices.includes(dependency)) report("THIRD_PARTY_NOTICES.txt", [`missing reviewed dependency ${dependency}`]);
async function inspectDirectory(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) await inspectDirectory(file, relative);
    else {
      const contents = await read(file);
      report(file, inspectSiteFile(relative, contents));
      report(file, inspectProvenance(contents));
    }
  }
}
await inspectDirectory("apps/site/dist");
const tracked = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" }).split("\0").filter(Boolean);
for (const file of tracked) {
  if (!/\.(?:[cm]?[jt]sx?|mjs|json|yaml|yml|md|astro|css|html|txt)$/u.test(file)) continue;
  const contents = await read(file);
  report(file, inspectProvenance(contents));
  if (/^(?:apps\/extension|packages\/engine)\/src\/.*\.[jt]sx?$/u.test(file)) report(file, inspectJavaScript(contents, { firstParty: true, filename: file }));
  if (file.startsWith(".github/workflows/")) {
    for (const [, action] of contents.matchAll(/\buses:\s*([^\s#]+)/gu)) if (!/^[-\w./]+@[a-f0-9]{40}$/u.test(action)) report(file, [`workflow action must be pinned by full commit: ${action}`]);
  }
}
if (errors.length > 0) { console.error(errors.join("\n")); process.exitCode = 1; }
else console.log("Release artifacts satisfy the reviewed static contract. Runtime, platform, and human release gates remain separate.");
