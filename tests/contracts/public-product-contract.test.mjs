// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(file, "utf8");
const contract = JSON.parse(await read("docs/distribution/public-contract.json"));
const listing = await read("docs/distribution/chrome-web-store.md");
const pages = Object.fromEntries(await Promise.all(["privacy", "permissions", "scope", "license", "support", "docs", "install"].map(async (route) => [route, await read(`apps/site/dist/${route}/index.html`)])));

test("published trust copy agrees with the exact manifest permission and browser boundary", async () => {
  const manifest = JSON.parse(await read("apps/extension/.output/chrome-mv3/manifest.json"));
  assert.deepEqual([...manifest.permissions].sort(), [...contract.permissions].sort());
  assert.equal(manifest.manifest_version, contract.manifestVersion);
  assert.equal(manifest.incognito, contract.incognito);
  assert.equal("host_permissions" in manifest, false);
  assert.equal("content_scripts" in manifest, false);
  for (const permission of contract.permissions) {
    assert.ok(pages.permissions.includes(`<code>${permission}</code>`), permission);
    assert.ok(listing.includes(`\`${permission}\``), permission);
  }
  for (const excluded of ["tabs", "webNavigation", "clipboardWrite", "downloads", "debugger", "cookies", "history", "webRequest"]) {
    assert.ok(!manifest.permissions.includes(excluded), excluded);
    assert.ok(pages.permissions.includes(`<code>${excluded}</code>`), excluded);
    assert.ok(listing.includes(excluded), excluded);
  }
  for (const text of [pages.scope, listing]) for (const term of ["Chrome", "desktop", "stable", "HTTP", "HTTPS", "localhost", "Incognito", "iframe", "Shadow DOM", "file:", "mobile", "unsupported"]) assert.ok(text.includes(term), term);
  for (const capability of [...contract.scenarios, ...contract.detectors]) assert.ok(listing.includes(capability), capability);
});

test("retention and export claims match executable release-contract commitments", async () => {
  assert.equal(contract.schemaVersion, 3);
  assert.deepEqual(contract.retention, { area: "session", resultsPerTab: 1, history: false, tabCloseDeletes: true });
  assert.deepEqual(contract.export, { format: "Markdown", delivery: "download", extension: ".md", suggestedFilename: "ui-torture-lab-report.md", mimeType: "text/markdown;charset=utf-8", gestureRequired: true, previewEqualsPayload: true });
  assert.deepEqual(contract.locatorCopy, { delivery: "clipboard", payload: "displayed diagnostic locator", gestureRequired: true, fallback: "selection", uniqueSelectorGuaranteed: false, clipboardRead: false });
  for (const text of [pages.privacy, pages.docs, pages.permissions, listing]) {
    assert.ok(text.includes("Copy locator"));
    assert.match(text, /(?:explicit click|on your click)/u);
  }
  for (const text of [pages.privacy, pages.docs, listing]) assert.ok(text.includes("not guaranteed to be a unique selector"));
  for (const text of [pages.privacy, listing]) for (const term of ["Active Run State", "Previous-Target Snapshot", "session", "one", "redacted", "origin", "pathname", "query", "fragment", "Clear saved result", "tab", "no Run network request", "no automatic screenshot", "visible preview", "cannot guarantee anonymity"]) assert.ok(text.toLowerCase().includes(term.toLowerCase()), term);
  assert.equal(contract.runNetwork, false);
  assert.equal(contract.automaticScreenshots, false);
  assert.equal(contract.fullTextSerialization, false);
  // Behavioral enforcement lives in the installed-extension, sender-validation, and formatter suites.
  const runtime = await read("apps/extension/src/document-runtime/markdown-report.tsx");
  assert.match(runtime, /requestMarkdownDownload\(markdown, container\)/u);
  assert.doesNotMatch(runtime, /navigator\.clipboard/u);
  assert.match(runtime, /value=\{markdown\}/u);
  assert.doesNotMatch(runtime, /useEffect/u);
  assert.doesNotMatch(listing, /copy the (?:Evidence|visible deterministic Markdown)|Clipboard failure/iu);
  for (const text of [pages.privacy, pages.docs, pages.permissions, listing]) {
    assert.ok(text.includes("Download Report"));
    assert.ok(!text.includes("Copy Report as Markdown"));
  }
});

test("distribution, license, support, and pre-release status agree across public surfaces", () => {
  assert.equal(contract.price, "free");
  assert.equal(contract.accountRequired, false);
  assert.equal(contract.featureGates, false);
  assert.equal(contract.license, "Apache-2.0");
  assert.equal(contract.support, "best-effort");
  for (const term of ["free", "account", "key", "subscription", "payment", "advertising", "gated feature", "offline", "Apache", "proprietary", "branding", "Official Distribution"]) assert.ok(pages.license.includes(term), term);
  for (const term of ["best-effort", "latest Official Distribution", "Supported Scope", "SLA", "application-code consulting", "Private Vulnerability Reporting"]) {
    assert.ok(pages.support.includes(term), term);
    assert.ok(listing.includes(term), term);
  }
  assert.equal(contract.distributionStatus, "pre-release");
  assert.equal(contract.siteOrigin, "https://ui-torture-lab.pages.dev");
  assert.equal(contract.storeListing, null);
  assert.ok(pages.install.includes("not yet published"));
  assert.ok(listing.includes("pre-release draft"));
});
