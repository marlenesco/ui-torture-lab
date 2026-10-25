// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

let nextSessionId = 0;

const loadBackground = async ({
  executeScript,
  liveTabs = [{ id: 42 }],
  session = new Map(),
  afterAuthorization = async () => undefined,
}) => {
  const messageListeners = [];
  const connectListeners = [];
  const tabCreatedListeners = [];
  const tabRemovedListeners = [];
  const tabReplacedListeners = [];
  const toolbarListeners = [];
  const scriptCalls = [];
  const feedback = [];
  const scheduledFeedback = [];
  const storageAccessLevels = [];
  const backgroundCode = await readFile(
    "apps/extension/.output/chrome-mv3/background.js",
    "utf8",
  );

  const chrome = {
    action: {
      onClicked: {
        addListener(listener) {
          toolbarListeners.push(listener);
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
    runtime: {
      id: "test-extension",
      onMessage: {
        addListener(listener) {
          messageListeners.push(listener);
        },
      },
      onConnect: { addListener(listener) { connectListeners.push(listener); } },
    },
    scripting: {
      async executeScript(details) {
        scriptCalls.push(details);
        if (details.args?.[0]?.startsWith("tab-session-")) {
          await afterAuthorization();
          return [{ documentId: details.target.documentIds[0], frameId: 0, result: "mounted" }];
        }
        return executeScript(details);
      },
    },
    storage: {
      session: {
        async setAccessLevel(details) {
          storageAccessLevels.push(details.accessLevel);
        },
        async get(key) {
          if (key === null) return Object.fromEntries(session);
          return { [key]: session.get(key) };
        },
        async set(values) {
          for (const [key, value] of Object.entries(values)) {
            session.set(key, value);
          }
        },
        async remove(keys) {
          for (const key of Array.isArray(keys) ? keys : [keys]) session.delete(key);
        },
      },
    },
    tabs: {
      async query() {
        return liveTabs;
      },
      onCreated: {
        addListener(listener) {
          tabCreatedListeners.push(listener);
        },
      },
      onRemoved: {
        addListener(listener) {
          tabRemovedListeners.push(listener);
        },
      },
      onReplaced: {
        addListener(listener) {
          tabReplacedListeners.push(listener);
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
    crypto: {
      randomUUID() {
        nextSessionId += 1;
        return `tab-session-${nextSessionId}`;
      },
    },
    setTimeout(callback, delay) {
      scheduledFeedback.push({ callback, delay });
      return scheduledFeedback.length;
    },
    URL,
  });

  assert.equal(toolbarListeners.length, 1, "toolbar action must be the sole trigger");
  assert.equal(messageListeners.length, 1, "trusted context must accept Run activity updates");
  assert.deepEqual(storageAccessLevels, ["TRUSTED_CONTEXTS"]);
  assert.equal(tabCreatedListeners.length, 1, "tab creation must reset session identity");
  assert.equal(tabRemovedListeners.length, 1, "tab closure must clear session state");
  assert.equal(tabReplacedListeners.length, 1, "tab replacement must reset session identity");

  return {
    feedback,
    async flushFeedback() {
      for (const scheduled of scheduledFeedback) {
        scheduled?.callback();
      }
      await new Promise((resolve) => setImmediate(resolve));
    },
    invokeToolbar: toolbarListeners[0],
    bindGrant(sender, active = false) {
      const messages = [];
      const disconnect = [];
      const incoming = [];
      let closed = false;
      const port = {
        name: "ui-torture-lab/document-reachability", sender, messages,
        onMessage: { addListener(callback) { incoming.push(callback); } },
        onDisconnect: { addListener(callback) { disconnect.push(callback); } },
        postMessage(message) { messages.push(message); },
        disconnect() { if (!closed) { closed = true; for (const callback of disconnect) callback(); } },
      };
      connectListeners[0](port);
      for (const callback of incoming) callback({ type: "bind-page-grant", grantId: session.get(`ui-torture-lab:tab-session:${sender.tab?.id}`)?.grantId, active });
      return port;
    },
    invokeMessage: messageListeners[0],
    invokeGrantedMessage(message, sender) {
      return messageListeners[0]({ ...message, grantId: session.get(`ui-torture-lab:tab-session:${sender.tab?.id}`)?.grantId }, sender);
    },
    invokeTabCreated: tabCreatedListeners[0],
    invokeTabRemoved: tabRemovedListeners[0],
    invokeTabReplaced: tabReplacedListeners[0],
    session,
    scriptCalls,
  };
};

const settled = () => new Promise((resolve) => setImmediate(resolve));

const completedResult = (
  summary = "No supported Finding was produced.",
  findings = [],
) => ({
  coverage: {
    comparableTargets: 0,
    contributorTargets: 0,
    excludedTargets: 0,
    findingCount: 0,
    eligibleTargets: 0,
    ineffectiveTargets: 0,
    inconclusiveTargets: 0,
    mutatedTargets: 0,
    safeFailedTargets: 0,
    skippedTargets: 0,
  },
  findings,
  inconclusiveReasons: [],
  restore: { conflicts: [], status: "restored" },
  scenarioId: "long-text",
  status: "completed",
  summary,
});

const textClippingFinding = (preview) => ({
  affectedRange: {
    baselineRects: [],
    locator: "p#target",
    mutatedRects: [],
    preview,
  },
  affectedRanges: [{
    baselineRects: [],
    locator: "p#target",
    mutatedRects: [],
    preview,
  }],
  baseline: { visibleExtent: 10 },
  clippedAxis: "horizontal",
  computedStyles: { overflowX: "hidden", overflowY: "hidden", whiteSpace: "nowrap" },
  detectorId: "text-clipping",
  locator: "p#target",
  measuredDelta: 2,
  mutated: { hiddenExtent: 2 },
  possibleCause: "Proven clipping boundary.",
  scenarioId: "long-text",
  textOwner: { locator: "p#target" },
});

const authorizedBackground = async ({
  documentId = "document-1",
  liveTabs,
  session,
} = {}) => {
  const background = await loadBackground({
    executeScript: async (details) => {
      return [{
        documentId,
        frameId: 0,
        result: details.target.frameIds !== undefined
          ? { type: "target-probe-response", status: "matched", protocol: "https:" }
          : { type: "target-bootstrap-response", status: "bootstrapped", protocol: "https:", contentType: "text/html", topLevel: true },
      }];
    },
    liveTabs,
    session,
  });
  await background.invokeToolbar({ id: 42, url: "https://fixture.test/path?token=secret#fragment" });
  background.bindGrant({ documentId, frameId: 0, tab: { id: 42 } });
  await new Promise((resolve) => setImmediate(resolve));
  return background;
};

const currentResultKey = (session) =>
  [...session.keys()].find((key) => key.startsWith("ui-torture-lab:current-run-result:"));

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

  assert.equal(background.scriptCalls.length, 4);
  const probe = background.scriptCalls[0];
  assert.deepEqual(JSON.parse(JSON.stringify(probe.target)), {
    frameIds: [0],
    tabId: 42,
  });
  assert.equal(probe.world, "ISOLATED");
  assert.equal(probe.injectImmediately, true);
  assert.deepEqual(JSON.parse(JSON.stringify(probe.args)), [
    "http://127.0.0.1:4173/smoke/", probe.args[1],
  ]);
  assert.equal(typeof probe.func, "function");
  assert.equal(typeof probe.args[1], "string");
  assert.equal(background.scriptCalls[3].args[0], probe.args[1]);

  const bootstrap = background.scriptCalls[1];
  assert.deepEqual(JSON.parse(JSON.stringify(bootstrap.target)), {
    documentIds: ["document-1"],
    tabId: 42,
  });
  assert.equal(bootstrap.world, "ISOLATED");
  assert.equal(bootstrap.injectImmediately, true);
  assert.deepEqual(JSON.parse(JSON.stringify(bootstrap.args)), [
    "http://127.0.0.1:4173/smoke/", probe.args[1],
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

test("Run activity survives a service-worker restart for its authorized Document", async () => {
  let injectionNumber = 0;
  const initialWorker = await loadBackground({
    executeScript: async () => {
      injectionNumber += 1;
      return [{
        documentId: "document-1",
        frameId: 0,
        result: injectionNumber === 1
          ? { type: "target-probe-response", status: "matched", protocol: "https:" }
          : { type: "target-bootstrap-response", status: "bootstrapped", protocol: "https:", contentType: "text/html", topLevel: true },
      }];
    },
  });
  await initialWorker.invokeToolbar({ id: 42, url: "https://fixture.test/" });

  const restartedWorker = await loadBackground({
    executeScript: async () => {
      throw new Error("A Run activity message must not inject a new Document Runtime");
    },
    session: initialWorker.session,
  });
  restartedWorker.bindGrant({ documentId: "document-1", frameId: 0, tab: { id: 42 } });
  await settled();
  restartedWorker.invokeGrantedMessage(
    { active: true, type: "run-activity-changed" },
    { documentId: "document-1", frameId: 0, tab: { id: 42 } },
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(
    restartedWorker.feedback.some(
      ([kind, details]) => kind === "badge" && details.tabId === 42 && details.text === "RUN",
    ),
  );
});

test("Run activity only accepts the currently authorized Document", async () => {
  let injectionNumber = 0;
  const background = await loadBackground({
    executeScript: async () => {
      injectionNumber += 1;
      return [{
        documentId: "document-1",
        frameId: 0,
        result: injectionNumber === 1
          ? { type: "target-probe-response", status: "matched", protocol: "https:" }
          : { type: "target-bootstrap-response", status: "bootstrapped", protocol: "https:", contentType: "text/html", topLevel: true },
      }];
    },
  });

  await background.invokeToolbar({ id: 42, url: "https://fixture.test/" });
  background.bindGrant({ documentId: "document-1", frameId: 0, tab: { id: 42 } });
  await settled();
  const feedbackBeforeStaleMessage = background.feedback.length;
  background.invokeGrantedMessage(
    { active: true, type: "run-activity-changed" },
    { documentId: "document-previous", frameId: 0, tab: { id: 42 } },
  );
  assert.equal(background.feedback.length, feedbackBeforeStaleMessage);

  background.invokeGrantedMessage(
    { active: true, type: "run-activity-changed" },
    { documentId: "document-1", frameId: 0, tab: { id: 42 } },
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(
    background.feedback.some(
      ([kind, details]) => kind === "badge" && details.tabId === 42 && details.text === "RUN",
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

  assert.equal(background.scriptCalls.length, 4);
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

test("toolbar rejects a redacted target URL without injecting or requesting permissions", async () => {
  const background = await loadBackground({
    executeScript: async () => { throw new Error("An unavailable URL must not be injected"); },
  });
  await background.invokeToolbar({ id: 42 });
  assert.equal(background.scriptCalls.length, 0);
  assert.ok(background.feedback.some(([kind, details]) =>
    kind === "title" && details.tabId === 42 &&
    details.title === "This page is not supported. UI Torture Lab runs only on HTTP or HTTPS HTML pages. Serve local files through localhost.",
  ));
  assert.ok(background.feedback.some(([kind, details]) =>
    kind === "badge" && details.tabId === 42 && details.text === "!",
  ));
});

test("toolbar keeps a missing tab distinct from a redacted URL", async () => {
  const background = await loadBackground({
    executeScript: async () => { throw new Error("A missing tab must not be injected"); },
  });
  await background.invokeToolbar({ url: "https://fixture.test/" });
  assert.equal(background.scriptCalls.length, 0);
  assert.equal(background.feedback.length, 0);
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

  assert.equal(background.scriptCalls.length, 3);
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

test("worker keeps one validated current result and clear removes it", async () => {
  const background = await authorizedBackground();
  const sender = { documentId: "document-1", frameId: 0, tab: { id: 42 } };
  const page = { origin: "https://fixture.test", pathname: "/path" };

  background.invokeGrantedMessage(
    { page, result: completedResult("first"), type: "store-current-run-result" },
    sender,
  );
  await settled();
  const resultKey = currentResultKey(background.session);
  assert.ok(resultKey, "completion stores one result under tab-session identity");
  assert.equal(background.session.get(resultKey).result.summary, "first");

  background.invokeGrantedMessage(
    { page, result: completedResult("replacement"), type: "store-current-run-result" },
    sender,
  );
  await settled();
  assert.equal(currentResultKey(background.session), resultKey);
  assert.equal(background.session.get(resultKey).result.summary, "replacement");

  background.invokeGrantedMessage({ type: "clear-current-run-result" }, sender);
  await settled();
  assert.equal(currentResultKey(background.session), undefined);
});

test("worker rejects forbidden fields and unredacted or unbounded valid-schema text", async () => {
  const background = await authorizedBackground();
  const sender = { documentId: "document-1", frameId: 0, tab: { id: 42 } };
  const rejectedResults = [
    { ...completedResult(), password: "hunter2" },
    completedResult("No supported Finding was produced.", [
      textClippingFinding("password=hunter2"),
    ]),
    completedResult("x".repeat(513)),
  ];

  for (const result of rejectedResults) {
    background.invokeGrantedMessage(
      {
        page: { origin: "https://fixture.test", pathname: "/path" },
        result,
        type: "store-current-run-result",
      },
      sender,
    );
    await settled();
  }

  assert.equal(currentResultKey(background.session), undefined);
  assert.equal(background.session.size, 1, "only the tab's authorization metadata is retained");
});

test("close after worker suspension clears session state before tab identifier reuse", async () => {
  const initialWorker = await authorizedBackground();
  const sender = { documentId: "document-1", frameId: 0, tab: { id: 42 } };
  initialWorker.invokeGrantedMessage(
    {
      page: { origin: "https://fixture.test", pathname: "/path" },
      result: completedResult(),
      type: "store-current-run-result",
    },
    sender,
  );
  await settled();
  const oldSession = initialWorker.session.get("ui-torture-lab:tab-session:42").id;

  const restartedWorker = await loadBackground({
    executeScript: async () => {
      throw new Error("closed tab must not be injected");
    },
    session: initialWorker.session,
  });
  restartedWorker.invokeTabRemoved(42);
  restartedWorker.invokeTabCreated({ id: 42 });
  await settled();
  await settled();

  const replacementSession = restartedWorker.session.get("ui-torture-lab:tab-session:42");
  assert.ok(replacementSession, "reused tab receives new session identity");
  assert.notEqual(replacementSession.id, oldSession);
  assert.equal(restartedWorker.session.get(`ui-torture-lab:current-run-result:${oldSession}`), undefined);
  assert.equal(currentResultKey(restartedWorker.session), undefined);
});

test("replacement after worker suspension discards removed-tab state and gives added tab a new session", async () => {
  const initialWorker = await authorizedBackground();
  const sender = { documentId: "document-1", frameId: 0, tab: { id: 42 } };
  initialWorker.invokeGrantedMessage(
    {
      page: { origin: "https://fixture.test", pathname: "/path" },
      result: completedResult(),
      type: "store-current-run-result",
    },
    sender,
  );
  await settled();
  const oldSession = initialWorker.session.get("ui-torture-lab:tab-session:42").id;

  const restartedWorker = await loadBackground({
    executeScript: async () => {
      throw new Error("replaced tab must not be injected");
    },
    liveTabs: [{ id: 42 }, { id: 43 }],
    session: initialWorker.session,
  });
  restartedWorker.invokeTabReplaced(43, 42);
  await settled();
  await settled();

  const addedSession = restartedWorker.session.get("ui-torture-lab:tab-session:43");
  assert.ok(addedSession, "replacement tab receives tab-session identity");
  assert.notEqual(addedSession.id, oldSession);
  assert.equal(restartedWorker.session.get("ui-torture-lab:tab-session:42"), undefined);
  assert.equal(restartedWorker.session.get(`ui-torture-lab:current-run-result:${oldSession}`), undefined);
});

test("worker startup reconciles orphan session state left while suspended", async () => {
  const session = new Map([
    ["ui-torture-lab:tab-session:9", { documentId: "old-document", id: "orphan-session" }],
    [
      "ui-torture-lab:current-run-result:orphan-session",
      {
        documentId: "old-document",
        page: { origin: "https://fixture.test", pathname: "/path" },
        result: completedResult(),
        state: "current",
        tabSessionId: "orphan-session",
      },
    ],
    [
      "ui-torture-lab:current-run-result:detached-session",
      {
        documentId: "old-document",
        page: { origin: "https://fixture.test", pathname: "/path" },
        result: completedResult(),
        state: "current",
        tabSessionId: "detached-session",
      },
    ],
  ]);

  await loadBackground({
    executeScript: async () => {
      throw new Error("orphan reconciliation must not inject");
    },
    session,
  });
  await settled();

  assert.equal(session.size, 0);
});

test("concurrent completions in separate tabs retain both session-scoped results", async () => {
  const background = await loadBackground({
    executeScript: async (details) => {
      const documentId = `document-${details.target.tabId}`;
      return [{
        documentId,
        frameId: 0,
        result: details.target.frameIds !== undefined
          ? { type: "target-probe-response", status: "matched", protocol: "https:" }
          : { type: "target-bootstrap-response", status: "bootstrapped", protocol: "https:", contentType: "text/html", topLevel: true },
      }];
    },
    liveTabs: [{ id: 42 }, { id: 43 }],
  });
  await background.invokeToolbar({ id: 42, url: "https://fixture.test/one" });
  await background.invokeToolbar({ id: 43, url: "https://fixture.test/two" });

  background.invokeGrantedMessage(
    { page: { origin: "https://fixture.test", pathname: "/one" }, result: completedResult("one"), type: "store-current-run-result" },
    { documentId: "document-42", frameId: 0, tab: { id: 42 } },
  );
  background.invokeGrantedMessage(
    { page: { origin: "https://fixture.test", pathname: "/two" }, result: completedResult("two"), type: "store-current-run-result" },
    { documentId: "document-43", frameId: 0, tab: { id: 43 } },
  );
  await settled();

  const results = [...background.session.entries()]
    .filter(([key]) => key.startsWith("ui-torture-lab:current-run-result:"))
    .map(([, value]) => value.result.summary)
    .sort();
  assert.deepEqual(results, ["one", "two"]);
});

test("navigation invalidates the live grant and retains one non-live result atomically", async () => {
  const background = await authorizedBackground();
  const sender = { documentId: "document-1", frameId: 0, tab: { id: 42 } };
  const grantId = background.session.get("ui-torture-lab:tab-session:42").grantId;
  const result = { ...completedResult(), terminationReason: "same-document-navigation" };
  await background.invokeMessage({ type: "invalidate-page-grant", grantId, page: { origin: "https://fixture.test", pathname: "/path" }, result }, sender);
  const session = background.session.get("ui-torture-lab:tab-session:42");
  assert.equal(session.documentId, null);
  assert.equal(background.session.get(currentResultKey(background.session)).state, "previous");
  const feedbackCount = background.feedback.length;
  background.invokeMessage({ type: "run-activity-changed", grantId, active: true }, sender);
  await settled();
  assert.equal(background.feedback.length, feedbackCount, "expired live activity must not restore the toolbar Run indicator");
  background.invokeMessage({ type: "clear-current-run-result", grantId }, sender);
  await settled();
  assert.equal(currentResultKey(background.session), undefined, "manual clear remains available on the ended context");
});

test("old logical-context messages cannot overwrite or revoke a reauthorized same Document", async () => {
  const background = await authorizedBackground();
  const sender = { documentId: "document-1", frameId: 0, tab: { id: 42 } };
  const oldGrant = background.session.get("ui-torture-lab:tab-session:42").grantId;
  const page = { origin: "https://fixture.test", pathname: "/path" };
  await background.invokeMessage({ type: "invalidate-page-grant", grantId: oldGrant, page, result: completedResult("previous") }, sender);
  await background.invokeToolbar({ id: 42, url: "https://fixture.test/new-route" });
  const newGrant = background.session.get("ui-torture-lab:tab-session:42").grantId;
  assert.notEqual(newGrant, oldGrant);
  background.invokeMessage({ type: "store-current-run-result", grantId: newGrant, page, result: completedResult("new") }, sender);
  await settled();
  for (const message of [
    { type: "invalidate-page-grant", page, result: completedResult("stale") },
    { type: "store-current-run-result", page, result: completedResult("stale") },
    { type: "clear-current-run-result" },
    { type: "run-activity-changed", active: true },
  ]) {
    await background.invokeMessage({ ...message, grantId: oldGrant }, sender);
  }
  await settled();
  assert.equal(background.session.get("ui-torture-lab:tab-session:42").grantId, newGrant);
  assert.equal(background.session.get("ui-torture-lab:tab-session:42").documentId, "document-1");
  assert.equal(background.session.get(currentResultKey(background.session)).result.summary, "new");
});

test("live messages require their exact toolbar grant token", async () => {
  const background = await authorizedBackground();
  const sender = { documentId: "document-1", frameId: 0, tab: { id: 42 } };
  const count = background.feedback.length;
  for (const grantId of [undefined, "", "wrong-grant"]) {
    background.invokeMessage({ type: "run-activity-changed", grantId, active: true }, sender);
  }
  await settled();
  assert.equal(background.feedback.length, count);
});

test("port loss clears reachability and Run feedback without revoking the live page grant", async () => {
  const background = await authorizedBackground();
  const sender = { documentId: "document-1", frameId: 0, tab: { id: 42 } };
  const grantId = background.session.get("ui-torture-lab:tab-session:42").grantId;
  const port = background.bindGrant(sender, true);
  await settled();
  assert.equal(background.feedback.filter(([kind]) => kind === "badge").at(-1)[1].text, "RUN");
  port.disconnect();
  await settled();
  assert.equal(background.feedback.filter(([kind]) => kind === "badge").at(-1)[1].text, "");
  assert.equal(background.session.get("ui-torture-lab:tab-session:42").documentId, "document-1");
  background.invokeMessage({ type: "run-activity-changed", grantId, active: true }, sender);
  await settled();
  assert.equal(background.feedback.filter(([kind]) => kind === "badge").at(-1)[1].text, "");
  background.bindGrant(sender, true);
  await settled();
  assert.equal(background.feedback.filter(([kind]) => kind === "badge").at(-1)[1].text, "RUN");
});

test("an older port disconnect cannot clear a newer connection's Run indicator", async () => {
  const background = await authorizedBackground();
  const sender = { documentId: "document-1", frameId: 0, tab: { id: 42 } };
  const old = background.bindGrant(sender, true);
  await settled();
  background.bindGrant(sender, true);
  await settled();
  old.disconnect();
  await settled();
  assert.equal(background.feedback.filter(([kind]) => kind === "badge").at(-1)[1].text, "RUN");
});

test("a child frame cannot bind a top-level Run transport", async () => {
  const background = await authorizedBackground();
  const count = background.feedback.length;
  const port = background.bindGrant({ documentId: "document-1", frameId: 1, tab: { id: 42 } }, true);
  await settled();
  assert.equal(background.feedback.length, count);
  assert.equal(port.messages.length, 0);
});

test("a late older toolbar probe cannot replace the newer grant or its feedback", async () => {
  let releaseFirst;
  let enteredFirst;
  const firstEntered = new Promise((resolve) => { enteredFirst = resolve; });
  let calls = 0;
  const probe = { type: "target-probe-response", status: "matched", protocol: "http:" };
  const background = await loadBackground({ executeScript: async (details) => {
    if (++calls === 1) {
      enteredFirst();
      return new Promise((resolve) => { releaseFirst = () => resolve([{ frameId: 0, documentId: "document-1", result: probe }]); });
    }
    return [{ frameId: 0, documentId: "document-1", result: details.target.frameIds ? probe : {
      type: "target-bootstrap-response", status: "bootstrapped", protocol: "http:", contentType: "text/html", topLevel: true,
    } }];
  } });
  const old = background.invokeToolbar({ id: 42, url: "http://127.0.0.1:4173/smoke/" });
  await firstEntered;
  await background.invokeToolbar({ id: 42, url: "http://127.0.0.1:4173/smoke/" });
  const current = JSON.stringify(background.session.get("ui-torture-lab:tab-session:42"));
  const feedback = background.feedback.length;
  releaseFirst();
  await old;
  assert.equal(JSON.stringify(background.session.get("ui-torture-lab:tab-session:42")), current);
  assert.equal(background.feedback.length, feedback);
});

test("a context ended before toolbar feedback cannot be reported as authorized", async () => {
  let injection = 0;
  const background = await loadBackground({
    executeScript: async () => [{ frameId: 0, documentId: "document-1", result: ++injection === 1
      ? { type: "target-probe-response", status: "matched", protocol: "http:" }
      : { type: "target-bootstrap-response", status: "bootstrapped", protocol: "http:", contentType: "text/html", topLevel: true } }],
    afterAuthorization: async () => {
      await background.invokeGrantedMessage({ type: "invalidate-page-grant", page: { origin: "http://127.0.0.1:4173", pathname: "/smoke/" }, result: null }, { tab: { id: 42 }, frameId: 0, documentId: "document-1" });
    },
  });
  await background.invokeToolbar({ id: 42, url: "http://127.0.0.1:4173/smoke/" });
  assert.equal(background.session.get("ui-torture-lab:tab-session:42").documentId, null);
  assert.equal(background.feedback.filter(([kind]) => kind === "badge").at(-1)[1].text, "");
});
