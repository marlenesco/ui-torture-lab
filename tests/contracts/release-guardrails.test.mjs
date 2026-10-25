// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { inspectJavaScript, inspectManifest, inspectProvenance, inspectSiteFile, scriptCreatorFingerprint } from "../../scripts/release-policy.mjs";

const contract = JSON.parse(await readFile("docs/distribution/public-contract.json", "utf8"));
const base = { manifest_version: 3, incognito: "not_allowed", permissions: contract.permissions, minimum_chrome_version: "155", version: "0.0.0", background: { service_worker: "background.js" }, action: {} };

test("manifest guard rejects expanded access and altered execution surfaces", () => {
  assert.deepEqual(inspectManifest(base, contract), []);
  for (const change of [
    { permissions: [...contract.permissions, "tabs"] }, { permissions: ["activeTab"] }, { incognito: "spanning" }, { manifest_version: 2 }, { minimum_chrome_version: "100" },
    { host_permissions: [] }, { optional_host_permissions: ["<all_urls>"] }, { optional_permissions: ["debugger"] }, { content_scripts: [] }, { web_accessible_resources: [] }, { externally_connectable: {} }, { sandbox: {} }, { devtools_page: "devtools.html" }, { side_panel: {} }, { chrome_url_overrides: {} }, { declarative_net_request: {} }, { content_security_policy: {} },
    { background: { page: "server.html" } }, { action: { default_popup: "popup.html" } }, { version: "latest" },
  ]) assert.ok(inspectManifest({ ...base, ...change }, contract).length > 0, JSON.stringify(change));
});

test("injection guard requires explicit isolated main-frame or verified-document addressing", () => {
  const valid = 'chrome.scripting.executeScript({target:{tabId:id, frameIds:[0]},world:"ISOLATED",func:probe})';
  assert.deepEqual(inspectJavaScript(valid), []);
  assert.deepEqual(inspectJavaScript('chrome.scripting.executeScript({target:{tabId:id, documentIds:[doc]},world:`ISOLATED`,files:["/document-runtime.js"]})'), []);
  for (const value of [
    valid.replace('"ISOLATED"', '"MAIN"'), valid.replace('"ISOLATED"', 'world'), valid.replace("frameIds:[0]", "frameIds:[1]"), valid.replace("frameIds:[0]", "allFrames:true"), valid.replace("frameIds:[0]", "documentIds:[a,b]"), valid.replace("frameIds:[0]", "...scope"), valid.replace("target:{", "...options,target:{"),
    'chrome.scripting.executeScript(config)', valid.replace("func:probe", 'files:["https://example.com/code.js"]'),
  ]) assert.ok(inspectJavaScript(value).length > 0, value);
  assert.match(inspectJavaScript(valid, { requireInjection: true }).join(), /four reviewed toolbar injections/u);
});

test("capability guard rejects network clients, page bridges, remote code, and persistent storage", () => {
  for (const source of [
    'fetch("/")', 'window["fetch"]("/")', 'window.fetch("/")', 'new XMLHttpRequest()', 'new WebSocket("wss://example.com")', 'new EventSource("/")', 'new WebTransport("https://example.com")', 'navigator.sendBeacon("/", data)', 'importScripts("https://example.com/code.js")', 'import("./remote.js")', 'eval(code)', 'new Function(code)',
    'chrome.tabs.captureVisibleTab(null,{format:"png"})', 'chrome.tabs["captureVisibleTab"]()', 'chrome.tabs.captureTab(42)', 'chrome.tabCapture.capture({})', 'chrome.desktopCapture.chooseDesktopMedia([])', 'navigator.mediaDevices.getDisplayMedia({video:true})', 'navigator.mediaDevices.getUserMedia({video:true})', 'canvas.captureStream()',
    'new CustomEvent("bridge")', 'window.postMessage(data)', 'self.postMessage(data)', 'postMessage(data)', 'document.createElement("script")', 'document.createElementNS("namespace", "script")', 'history.pushState = patched', 'history["replaceState"] = patched', 'Object.defineProperty(history,"pushState", descriptor)', 'Object.assign(window.history, patches)', 'chrome.storage.local.set(data)', 'chrome.storage.sync.get(null)',
  ]) assert.ok(inspectJavaScript(source).length > 0, source);
  for (const source of ['localStorage.getItem("x")', 'sessionStorage.getItem("x")', 'indexedDB.open("x")', 'window.__NEXT_DATA__', 'window.__VUE__', 'window.__REACT_DEVTOOLS_GLOBAL_HOOK__']) assert.ok(inspectJavaScript(source, { firstParty: true }).length > 0, source);
  assert.deepEqual(inspectJavaScript('port.postMessage(message); new MessageChannel().port1.postMessage(null); chrome.storage.session.set(data); document.createElement("div"); history.pushState({}, "", "/");'), []);
});

test("static-site guard rejects dynamic output, remote assets, trackers, and hidden redirects", () => {
  assert.deepEqual(inspectSiteFile("docs/index.html", '<html><link rel="canonical" href="https://example.com/docs/"><link rel="stylesheet" href="/_astro/site.css"><a href="https://github.com/">Source</a></html>'), []);
  assert.deepEqual(inspectSiteFile("_astro/site.css", 'body { font-family: system-ui; }'), []);
  for (const [file, contents] of [
    ["worker.js", ""], ["functions/index.html", ""], ["_worker.js", ""], ["server/index.html", ""],
    ["index.html", "<script>track()</script>"], ["index.html", "<astro-island>"], ["index.html", "<iframe src='/embed'>"], ["index.html", "<form>"], ["index.html", "<body onload='track()'>"], ["index.html", '<img src="https://example.com/pixel">'], ["index.html", '<link rel="stylesheet" href="//example.com/fonts.css">'], ["index.html", '<a href="javascript:alert(1)">'], ["index.html", '<meta http-equiv="refresh" content="0;url=/">'], ["site.css", '@import "font.css";'], ["site.css", 'a{background:url(https://example.com/a.png)}'],
  ]) assert.ok(inspectSiteFile(file, contents).length > 0, `${file}: ${contents}`);
});

test("provenance guard rejects credentials and private URLs while allowing synthetic public fixtures", () => {
  for (const value of ["-----BEGIN " + "PRIVATE KEY-----", "ghp_" + "a".repeat(36), "AKIA" + "A".repeat(16), "https://" + "name:pass@example.com", "https://" + "10.1.2.3/", "https://" + "192.168.1.2/", "http://" + "172.20.1.2/", "https://" + "portal.internal/"]) assert.ok(inspectProvenance(value).length > 0, value);
  assert.deepEqual(inspectProvenance("http://127.0.0.1:4173/ https://example.invalid/ https://github.com/marlenesco/ui-torture-lab"), []);
});

test("reviewed vendor exceptions match complete function behavior and never exempt first-party code", () => {
  const code = 'function renderer(doc){ const script = doc.createElement("script"); script.async = true; return script; }';
  const tree = ts.createSourceFile("vendor.js", code, ts.ScriptTarget.Latest, true);
  let fingerprint;
  const visit = (node) => {
    if (ts.isCallExpression(node)) fingerprint = scriptCreatorFingerprint(node);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.equal(typeof fingerprint, "string");
  const options = { reviewedScriptCreators: [fingerprint] };
  assert.deepEqual(inspectJavaScript(code, options), []);
  assert.deepEqual(inspectJavaScript(code.replaceAll("script", "resource").replace('createElement("resource")', 'createElement("script")'), options), []);
  assert.ok(inspectJavaScript(code.replace("async = true", "async = false"), options).length > 0);
  assert.ok(inspectJavaScript(`${code}\n${code}`, options).length > 0);
  assert.ok(inspectJavaScript(code, { ...options, firstParty: true }).length > 0);
  assert.ok(inspectJavaScript('<script src="https://example.com/code.js"/>', { firstParty: true }).length > 0);
  assert.ok(inspectJavaScript('import { preinit } from "react-dom";', { firstParty: true }).length > 0);
  assert.ok(inspectJavaScript("function (").length > 0);
});

test("dependency budget and install hooks remain intentional and fully pinned", async () => {
  const extension = JSON.parse(await readFile("apps/extension/package.json", "utf8"));
  const renderer = JSON.parse(await readFile("docs/distribution/reviewed-renderer.json", "utf8"));
  assert.deepEqual(extension.dependencies, { "@ui-torture-lab/engine": "workspace:*", react: "19.2.8", "react-dom": "19.2.8" });
  assert.equal(renderer.version, extension.dependencies["react-dom"]);
  assert.equal(extension.scripts.postinstall, "wxt prepare");
  for (const filename of ["package.json", "apps/site/package.json", "packages/engine/package.json", "apps/extension/package.json"]) {
    const entry = JSON.parse(await readFile(filename, "utf8"));
    assert.equal(entry.license, "Apache-2.0");
    for (const version of Object.values({ ...entry.dependencies, ...entry.devDependencies })) assert.match(version, /^(?:\d+\.\d+\.\d+|workspace:\*)$/u, filename);
    if (filename !== "apps/extension/package.json") assert.equal(entry.scripts?.postinstall, undefined);
    if (filename.includes("engine") || filename.includes("site")) assert.deepEqual(entry.dependencies ?? {}, {});
  }
  const workspace = await readFile("pnpm-workspace.yaml", "utf8");
  assert.deepEqual([...workspace.matchAll(/^[ ]{2}([a-z-]+): true$/gmu)].map(([, name]) => name).sort(), ["esbuild", "sharp"]);
});

test("publication gate rejects placeholders, missing validation, dirty source, and untraceable tags", async () => {
  const { inspectReleaseReadiness } = await import("../../scripts/release-policy.mjs");
  const ready = {
    contract: { siteOrigin: "https://official.example.com", storeListing: "https://chromewebstore.google.com/detail/tool/" + "a".repeat(32) },
    gates: { technicalValidation: "passed", productValidation: "passed", siteDeployment: "passed", sourceProtection: "passed" },
    version: "1.0.0", clean: true, node: "24.13.1", declaredNode: "24.13.1", siteOrigin: "https://official.example.com", tagMatches: true,
  };
  assert.deepEqual(inspectReleaseReadiness(ready), []);
  assert.ok(inspectReleaseReadiness({ ...ready, gates: { ...ready.gates, technicalValidation: "pending" } }).some(error => error.includes("technicalValidation")), "passing the adopted simulated Product Validation criterion cannot waive manual Technical Validation");
  for (const change of [{ version: "0.0.0" }, { clean: false }, { node: "24.22.1" }, { tagMatches: false }, { siteOrigin: "http://localhost:4321" }, { contract }, { gates: {} }, { contract: { siteOrigin: "https://localhost", storeListing: null } }]) assert.ok(inspectReleaseReadiness({ ...ready, ...change }).length > 0);
});

test("upstream license fallback is the reviewed public Git blob and TypeScript generics parse correctly", async () => {
  const { createHash } = await import("node:crypto");
  const license = await readFile("docs/distribution/licenses/wxt-MIT.txt");
  assert.equal(createHash("sha1").update(`blob ${license.length}\0`).update(license).digest("hex"), "5d1a7c76daa510b00a6a04079aed9cc6b98502b4");
  assert.deepEqual(inspectJavaScript("const identity = <T>(value: T): T => value;", { filename: "example.ts", firstParty: true }), []);
});
