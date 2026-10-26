// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(await readFile("apps/extension/src/document-runtime/locator-clipboard.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = vm.createContext({ exports: {} });
vm.runInContext(code, context);
const copy = context.exports.requestLocatorCopy;

test("locator copy writes exactly the displayed label once during an active trusted gesture", async () => {
  const writes = [];
  const locator = "div#注文";
  assert.equal(await copy(locator, { trusted: true, active: true, clipboard: { async writeText(text) { writes.push(text); } } }), true);
  assert.deepEqual(writes, [locator]);
});

for (const [trusted, active] of [[false, false], [false, true], [true, false]]) {
  test(`locator copy rejects trusted=${trusted}, active=${active} without accessing the clipboard`, async () => {
    let touched = false;
    assert.equal(await copy("div", { trusted, active, clipboard: { get writeText() { touched = true; throw new Error("unexpected access"); } } }), false);
    assert.equal(touched, false);
  });
}

test("missing Clipboard API and rejected writes request manual fallback without claiming success", async () => {
  assert.equal(await copy("div", { trusted: true, active: true, clipboard: undefined }), false);
  for (const writeText of [() => { throw new Error("blocked"); }, async () => { throw new Error("denied"); }]) {
    assert.equal(await copy("div", { trusted: true, active: true, clipboard: { writeText } }), false);
  }
});
