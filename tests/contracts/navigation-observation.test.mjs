// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile("apps/extension/src/target-page/navigation.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports });
const { observeSameDocumentNavigation } = exports;

test("committed entry events are observed without reading page state and stop detaches the observer", () => {
  const navigation = new EventTarget();
  navigation.currentEntry = {};
  const view = Object.assign(new EventTarget(), { navigation });
  let changes = 0;
  const observer = observeSameDocumentNavigation(view, () => { changes++; });
  assert.equal(observer.complete, true);
  navigation.dispatchEvent(new Event("currententrychange"));
  view.dispatchEvent(new Event("hashchange"));
  assert.equal(changes, 1);
  observer.stop();
  navigation.dispatchEvent(new Event("currententrychange"));
  assert.equal(changes, 1);
});

for (const navigation of [undefined, Object.assign(new EventTarget(), { currentEntry: null })]) {
  test(`missing usable Navigation entries (${navigation === undefined ? "absent" : "disabled"}) explicitly limit observation`, () => {
    const view = Object.assign(new EventTarget(), { navigation });
    let changes = 0;
    const observer = observeSameDocumentNavigation(view, () => { changes++; });
    assert.equal(observer.complete, false);
    view.dispatchEvent(new Event("popstate"));
    view.dispatchEvent(new Event("hashchange"));
    assert.equal(changes, 2);
    observer.stop();
    view.dispatchEvent(new Event("popstate"));
    assert.equal(changes, 2);
  });
}
