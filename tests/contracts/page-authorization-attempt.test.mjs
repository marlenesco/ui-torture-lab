// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(await readFile("apps/extension/src/target-page/bootstrap.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const getAttempt = (context) => vm.runInContext('globalThis[Symbol.for("ui-torture-lab/page-authorization-attempt")]', context);
const url = "http://127.0.0.1:4173/smoke/?private=synthetic";

function fixture() {
  class TrackedTarget extends EventTarget {
    listeners = new Map();
    get count() { return [...this.listeners.values()].reduce((sum, entries) => sum + entries.size, 0); }
    addEventListener(...args) {
      const entries = this.listeners.get(args[0]) ?? new Set();
      entries.add(args[1]); this.listeners.set(args[0], entries);
      super.addEventListener(...args);
    }
    removeEventListener(...args) { this.listeners.get(args[0])?.delete(args[1]); super.removeEventListener(...args); }
  }
  const navigation = Object.assign(new TrackedTarget(), { currentEntry: {} });
  const window = Object.assign(new TrackedTarget(), { navigation, location: { href: url, protocol: "http:" } });
  window.top = window;
  const document = { contentType: "text/html" };
  const context = vm.createContext({ window, document, exports: {}, Symbol });
  vm.runInContext(code, context);
  return { context, window, document, navigation, api: context.exports };
}

for (const reason of ["non-html-document", "document-changed", "unsupported-protocol", "not-top-level-document"]) {
  test(`rejected ${reason} bootstrap drops the exact attempt's URL and listeners`, () => {
    const { context, api, window, document, navigation } = fixture();
    assert.equal(api.probeTargetPage(url, "attempt").status, "matched");
    const attempt = getAttempt(context);
    if (reason === "non-html-document") document.contentType = "application/pdf";
    if (reason === "document-changed") window.location.href = url + "#changed";
    if (reason === "unsupported-protocol") window.location.protocol = "file:";
    if (reason === "not-top-level-document") window.top = {};
    assert.equal(api.bootstrapTargetPage(url, "attempt").reason, reason);
    assert.equal(getAttempt(context), undefined);
    assert.equal(attempt.valid, false);
    assert.equal(attempt.expectedUrl, "");
    assert.equal(window.count, 0);
    assert.equal(navigation.count, 0);
  });
}

test("stale bootstrap or cancellation cannot release a newer pending authorization", () => {
  const { context, api, window, navigation } = fixture();
  api.probeTargetPage(url, "old");
  const old = getAttempt(context);
  api.probeTargetPage(url, "new");
  assert.equal(old.expectedUrl, "");
  assert.equal(api.bootstrapTargetPage(url, "old").status, "rejected");
  api.cancelPageAuthorizationAttempt("old");
  assert.equal(getAttempt(context).id, "new");
  assert.equal(getAttempt(context).valid, true);
  assert.equal(api.bootstrapTargetPage(url, "new").status, "bootstrapped");
  api.cancelPageAuthorizationAttempt("new");
  assert.equal(getAttempt(context), undefined);
  assert.equal(window.count, 0);
  assert.equal(navigation.count, 0);
});

test("a committed entry or Page Exit releases the provisional guard before returning", () => {
  for (const event of ["currententrychange", "pagehide"]) {
    const { context, api, window, navigation } = fixture();
    api.probeTargetPage(url, "attempt");
    (event === "pagehide" ? window : navigation).dispatchEvent(new Event(event));
    assert.equal(getAttempt(context), undefined);
    assert.equal(api.bootstrapTargetPage(url, "attempt").reason, "document-changed");
    assert.equal(window.count, 0);
    assert.equal(navigation.count, 0);
  }
});

for (const reason of ["document-changed", "unsupported-protocol", "not-top-level-document"]) {
  test(`rejected ${reason} probe never installs provisional listeners`, () => {
    const { context, api, window, navigation } = fixture();
    if (reason === "document-changed") window.location.href = url + "#changed";
    if (reason === "unsupported-protocol") window.location.protocol = "file:";
    if (reason === "not-top-level-document") window.top = {};
    assert.equal(api.probeTargetPage(url, "attempt").reason, reason);
    assert.equal(getAttempt(context), undefined);
    assert.equal(window.count + navigation.count, 0);
  });
}

test("fallback attempt observation and repeated cancellation release all listeners", () => {
  for (const event of ["hashchange", "popstate", "pagehide"]) {
    const { context, api, window } = fixture();
    window.navigation = undefined;
    api.probeTargetPage(url, "attempt");
    const attempt = getAttempt(context);
    assert.equal(window.count, 3);
    window.dispatchEvent(new Event(event));
    attempt.stop();
    assert.equal(attempt.expectedUrl, "");
    assert.equal(getAttempt(context), undefined);
    assert.equal(window.count, 0);
  }
});
