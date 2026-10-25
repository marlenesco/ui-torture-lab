// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(await readFile("apps/extension/src/document-runtime/markdown-download.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture(failure) {
  const blobs = [], revoked = [], timers = [], clicks = [];
  const container = {
    links: new Set(),
    ownerDocument: { createElement(tag) {
      assert.equal(tag, "a");
      return {
        click() {
          assert.ok(container.links.has(this));
          if (failure === "click") throw new Error("click failed");
          clicks.push({ href: this.href, filename: this.download, hidden: this.hidden });
        },
        remove() { container.links.delete(this); },
      };
    } },
    append(link) {
      if (failure === "append") throw new Error("append failed");
      this.links.add(link);
    },
  };
  const context = vm.createContext({ exports: {}, Blob, URL: {
    createObjectURL(blob) {
      if (failure === "create") throw new Error("create failed");
      blobs.push(blob);
      return `blob:synthetic/${blobs.length}`;
    },
    revokeObjectURL(url) { revoked.push(url); },
  }, setTimeout(callback, delay) { timers.push({ callback, delay }); } });
  vm.runInContext(code, context);
  return { download: text => context.exports.requestMarkdownDownload(text, container), container, blobs, revoked, timers, clicks };
}

test("Markdown download preserves exact UTF-8 bytes and exposes only the constant suggested filename", async () => {
  const f = fixture();
  const markdown = "# UI Torture Lab — Markdown Report\nCaffè 日本語\n";
  f.download(markdown);
  assert.equal(f.blobs[0].type, "text/markdown;charset=utf-8");
  assert.deepEqual(Buffer.from(await f.blobs[0].arrayBuffer()), Buffer.from(markdown, "utf8"));
  assert.deepEqual(f.clicks, [{ href: "blob:synthetic/1", filename: "ui-torture-lab-report.md", hidden: true }]);
  assert.equal(f.container.links.size, 0);
  assert.deepEqual(f.revoked, []);
  assert.equal(f.timers.length, 1);
  assert.ok(f.timers[0].delay > 0 && f.timers[0].delay <= 1000);
  f.timers[0].callback();
  assert.deepEqual(f.revoked, ["blob:synthetic/1"]);
});

for (const failure of ["create", "append", "click"]) {
  test(`failed ${failure} leaves no temporary link and releases any allocated object URL`, () => {
    const f = fixture(failure);
    assert.throws(() => f.download("# Report\n"), new RegExp(`${failure} failed`, "u"));
    assert.equal(f.container.links.size, 0);
    assert.deepEqual(f.clicks, []);
    for (const timer of f.timers) timer.callback();
    assert.deepEqual(f.revoked, failure === "create" ? [] : ["blob:synthetic/1"]);
  });
}

test("repeated requests retain the same suggested name and release each Blob independently", () => {
  const f = fixture();
  f.download("first"); f.download("second");
  assert.deepEqual(f.clicks.map(click => click.filename), ["ui-torture-lab-report.md", "ui-torture-lab-report.md"]);
  assert.equal(new Set(f.clicks.map(click => click.href)).size, 2);
  for (const timer of f.timers) timer.callback();
  assert.deepEqual(f.revoked, ["blob:synthetic/1", "blob:synthetic/2"]);
});
