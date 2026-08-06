// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const loadBackground = async ({ executeScript }) => {
  const listeners = [];
  const scriptCalls = [];
  const feedback = [];
  const scheduledFeedback = [];
  const backgroundCode = await readFile(
    "apps/extension/.output/chrome-mv3/background.js",
    "utf8",
  );

  const chrome = {
    action: {
      onClicked: {
        addListener(listener) {
          listeners.push(listener);
        },
      },
      async setBadgeBackgroundColor(details) {
        feedback.push(["background", details]);
      },
      async setBadgeText(details) {
        feedback.push(["badge", details]);
      },
      async setTitle(details) {
        feedback.push(["title", details]);
      },
    },
    runtime: { id: "test-extension" },
    scripting: {
      async executeScript(details) {
        scriptCalls.push(details);
        return executeScript(details);
      },
    },
    storage: {
      session: {
        async get() {
          throw new Error("Target authorization must not read Run Results");
        },
        async set() {
          throw new Error("Target authorization must not replace Run Results");
        },
      },
    },
  };

  vm.runInNewContext(backgroundCode, {
    chrome,
    clearTimeout(timerId) {
      scheduledFeedback[timerId - 1] = undefined;
    },
    console,
    setTimeout(callback, delay) {
      scheduledFeedback.push({ callback, delay });
      return scheduledFeedback.length;
    },
    URL,
  });

  assert.equal(listeners.length, 1, "toolbar action must be the sole trigger");

  return {
    feedback,
    async flushFeedback() {
      for (const scheduled of scheduledFeedback) {
        scheduled?.callback();
      }
      await new Promise((resolve) => setImmediate(resolve));
    },
    invokeToolbar: listeners[0],
    scriptCalls,
  };
};

test("toolbar authorizes one supported top-level Document in ISOLATED world", async () => {
  const expectedProbe = {
    type: "target-probe-response",
    status: "matched",
    protocol: "http:",
  };
  const expectedBootstrap = {
    type: "target-bootstrap-response",
    status: "bootstrapped",
    protocol: "http:",
    contentType: "text/html",
    topLevel: true,
  };
  let injectionNumber = 0;
  const background = await loadBackground({
    executeScript: async () => {
      injectionNumber += 1;
      return [
        {
          documentId: "document-1",
          frameId: 0,
          result: injectionNumber === 1 ? expectedProbe : expectedBootstrap,
        },
      ];
    },
  });

  await background.invokeToolbar({
    id: 42,
    url: "http://127.0.0.1:4173/smoke/",
  });

  assert.equal(background.scriptCalls.length, 3);
  const probe = background.scriptCalls[0];
  assert.deepEqual(JSON.parse(JSON.stringify(probe.target)), {
    frameIds: [0],
    tabId: 42,
  });
  assert.equal(probe.world, "ISOLATED");
  assert.equal(probe.injectImmediately, true);
  assert.deepEqual(JSON.parse(JSON.stringify(probe.args)), [
    "http://127.0.0.1:4173/smoke/",
  ]);
  assert.equal(typeof probe.func, "function");

  const bootstrap = background.scriptCalls[1];
  assert.deepEqual(JSON.parse(JSON.stringify(bootstrap.target)), {
    documentIds: ["document-1"],
    tabId: 42,
  });
  assert.equal(bootstrap.world, "ISOLATED");
  assert.equal(bootstrap.injectImmediately, true);
  assert.deepEqual(JSON.parse(JSON.stringify(bootstrap.args)), [
    "http://127.0.0.1:4173/smoke/",
  ]);
  assert.equal(typeof bootstrap.func, "function");

  const controlShell = background.scriptCalls[2];
  assert.deepEqual(JSON.parse(JSON.stringify(controlShell.target)), {
    documentIds: ["document-1"],
    tabId: 42,
  });
  assert.equal(controlShell.world, "ISOLATED");
  assert.equal(controlShell.injectImmediately, true);
  assert.deepEqual(JSON.parse(JSON.stringify(controlShell.files)), [
    "/document-runtime.js",
  ]);
  assert.equal(controlShell.func, undefined);
  assert.ok(
    background.feedback.some(
      ([kind, details]) =>
        kind === "badge" && details.tabId === 42 && details.text === "OK",
    ),
  );
});

test("authorization is rejected when the floating control shell cannot mount", async () => {
  let injectionNumber = 0;
  const background = await loadBackground({
    executeScript: async () => {
      injectionNumber += 1;
      if (injectionNumber === 3) {
        throw new Error("Document changed before the UI bundle mounted");
      }
      return [
        {
          documentId: "document-4",
          frameId: 0,
          result:
            injectionNumber === 1
              ? {
                  type: "target-probe-response",
                  status: "matched",
                  protocol: "https:",
                }
              : {
                  type: "target-bootstrap-response",
                  status: "bootstrapped",
                  protocol: "https:",
                  contentType: "text/html",
                  topLevel: true,
                },
        },
      ];
    },
  });

  await background.invokeToolbar({
    id: 42,
    url: "https://fixture.test/",
  });

  assert.equal(background.scriptCalls.length, 3);
  assert.ok(
    background.feedback.some(
      ([kind, details]) =>
        kind === "title" &&
        details.tabId === 42 &&
        details.title.includes("could not mount its control shell"),
    ),
  );
});

test("toolbar rejects unsupported targets before injection", async () => {
  const unsupportedTargets = [
    "file:///tmp/fixture.html",
    "data:text/html,<h1>fixture</h1>",
    "blob:https://example.test/document-id",
    "chrome://settings/",
    "chrome-extension://another-extension/page.html",
  ];

  for (const url of unsupportedTargets) {
    const background = await loadBackground({
      executeScript: async () => {
        throw new Error(`Unexpected injection for ${url}`);
      },
    });

    await background.invokeToolbar({ id: 42, url });

    assert.equal(background.scriptCalls.length, 0);
    assert.ok(
      background.feedback.some(
        ([kind, details]) =>
          kind === "badge" && details.tabId === 42 && details.text === "!",
      ),
    );
    await background.flushFeedback();
    assert.ok(
      background.feedback.some(
        ([kind, details]) =>
          kind === "badge" && details.tabId === 42 && details.text === "",
      ),
    );
  }
});

test("toolbar rejects a same-URL Document replacement between probe and bootstrap", async () => {
  let injectionNumber = 0;
  const background = await loadBackground({
    executeScript: async () => {
      injectionNumber += 1;
      if (injectionNumber === 2) {
        throw new Error("document-2 disappeared after an identical-URL reload");
      }
      return [
        {
          documentId: "document-2",
          frameId: 0,
          result: {
            type: "target-probe-response",
            status: "matched",
            protocol: "https:",
          },
        },
      ];
    },
  });

  await background.invokeToolbar({
    id: 42,
    url: "https://fixture.test/same-url",
  });

  assert.equal(background.scriptCalls.length, 2);
  assert.deepEqual(
    JSON.parse(JSON.stringify(background.scriptCalls[1].target)),
    { documentIds: ["document-2"], tabId: 42 },
  );
  assert.ok(
    background.feedback.some(
      ([kind, details]) =>
        kind === "title" &&
        details.tabId === 42 &&
        details.title.includes("changed before authorization"),
    ),
  );
});

test("trusted context rejects malformed bootstrap messages", async () => {
  let injectionNumber = 0;
  const background = await loadBackground({
    executeScript: async () => {
      injectionNumber += 1;
      return [
        {
          documentId: "document-3",
          frameId: 0,
          result:
            injectionNumber === 1
              ? {
                  type: "target-probe-response",
                  status: "matched",
                  protocol: "https:",
                }
              : {
                  type: "target-bootstrap-response",
                  status: "bootstrapped",
                  protocol: "file:",
                  contentType: "text/html",
                  topLevel: true,
                  unexpectedPageData: "must not cross the boundary",
                },
        },
      ];
    },
  });

  await background.invokeToolbar({
    id: 42,
    url: "https://fixture.test/",
  });

  assert.ok(
    background.feedback.some(
      ([kind, details]) =>
        kind === "title" &&
        details.tabId === 42 &&
        details.title.includes("could not verify"),
    ),
  );
});
