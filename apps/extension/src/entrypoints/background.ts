// SPDX-License-Identifier: Apache-2.0

import "@ui-torture-lab/engine";
import { browser } from "wxt/browser";
import {
  authorizeTargetPage,
  rejectTargetAuthorization,
} from "../target-page/authorize";
import { mountTargetPageControlShell } from "../target-page/control-shell";
import {
  isStoredRunResult,
  runResultStorageKey,
  tabSessionStorageKey,
  type StoredRunResult,
  type TabSession,
} from "../target-page/current-run-result";
import { showAuthorizationFeedback, showRunActivity } from "../target-page/feedback";
import {
  isInvalidateGrantMessage,
  isClearRunResultMessage,
  isReadRunResultMessage,
  isRunActivityMessage,
  isStoreRunResultMessage,
  storePreviousRunResultMessageType,
} from "../target-page/messages";

const readTabSession = async (tabId: number): Promise<TabSession | null> => {
  const stored = await browser.storage.session.get(tabSessionStorageKey(tabId));
  const session = stored[tabSessionStorageKey(tabId)];
  return typeof session === "object" && session !== null &&
    typeof (session as TabSession).id === "string" &&
    ((session as TabSession).documentId === null ||
      typeof (session as TabSession).documentId === "string")
    ? { ...(session as TabSession), grantId: typeof (session as TabSession).grantId === "string" ? (session as TabSession).grantId : null }
    : null;
};

const writeTabSession = (tabId: number, session: TabSession): Promise<void> =>
  browser.storage.session.set({ [tabSessionStorageKey(tabId)]: session });

const ensureTabSession = async (tabId: number): Promise<TabSession> => {
  const existing = await readTabSession(tabId);
  if (existing !== null) return existing;
  const session = { documentId: null, grantId: null, id: crypto.randomUUID() } as const;
  await writeTabSession(tabId, session);
  return session;
};

const readRunResult = async (sessionId: string): Promise<StoredRunResult | null> => {
  const stored = await browser.storage.session.get(runResultStorageKey(sessionId));
  const result = stored[runResultStorageKey(sessionId)];
  return isStoredRunResult(result) ? result : null;
};

const clearTabSession = async (tabId: number): Promise<void> => {
  const session = await readTabSession(tabId);
  await browser.storage.session.remove([
    tabSessionStorageKey(tabId),
    ...(session === null ? [] : [runResultStorageKey(session.id)]),
  ]);
};

const resetTabSession = async (tabId: number): Promise<void> => {
  await clearTabSession(tabId);
  await ensureTabSession(tabId);
};

const reconcileOrphans = async (): Promise<void> => {
  const tabs = await browser.tabs.query({});
  const liveTabIds = new Set(
    tabs.flatMap((tab) => typeof tab.id === "number" ? [tab.id] : []),
  );
  const stored = await browser.storage.session.get(null);
  const liveSessionIds = new Set<string>();
  const orphanKeys = Object.keys(stored).flatMap((key) => {
    if (!key.startsWith("ui-torture-lab:tab-session:")) return [];
    const tabId = Number.parseInt(key.slice("ui-torture-lab:tab-session:".length), 10);
    const session = stored[key];
    const sessionId = typeof session === "object" && session !== null
      ? (session as { readonly id?: unknown }).id
      : undefined;
    if (Number.isInteger(tabId) && liveTabIds.has(tabId) && typeof sessionId === "string") {
      liveSessionIds.add(sessionId);
      return [];
    }
    return [key];
  });
  const orphanResultKeys = Object.entries(stored).flatMap(([key, value]) =>
    key.startsWith("ui-torture-lab:current-run-result:") &&
    (!isStoredRunResult(value) || !liveSessionIds.has(value.tabSessionId))
      ? [key]
      : [],
  );
  await browser.storage.session.remove([...orphanKeys, ...orphanResultKeys]);
};

const tabChains = new Map<number, Promise<void>>();
const enqueueTab = (tabId: number, work: () => Promise<void>): Promise<void> => {
  const next = (tabChains.get(tabId) ?? Promise.resolve())
    .catch(() => undefined)
    .then(work);
  tabChains.set(tabId, next);
  void next.finally(() => {
    if (tabChains.get(tabId) === next) tabChains.delete(tabId);
  });
  return next;
};

export default defineBackground(() => {
  void browser.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  const reconciled = reconcileOrphans().catch(() => undefined);

  browser.tabs.onCreated.addListener((tab) => {
    const tabId = tab.id;
    if (tabId !== undefined) void enqueueTab(tabId, () => resetTabSession(tabId));
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    void enqueueTab(tabId, () => clearTabSession(tabId));
  });
  browser.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
    void enqueueTab(removedTabId, () => clearTabSession(removedTabId));
    void enqueueTab(addedTabId, () => resetTabSession(addedTabId));
  });

  const authorizedSender = async (sender: unknown, grantId: string, allowEnded = false) => {
    await reconciled;
    const candidate = sender as {
      readonly documentId?: unknown;
      readonly frameId?: unknown;
      readonly tab?: { readonly id?: unknown };
    };
    if (
      typeof candidate.tab?.id !== "number" ||
      candidate.frameId !== 0 ||
      typeof candidate.documentId !== "string"
    ) return null;
    const session = await readTabSession(candidate.tab.id);
    return session !== null && (session.documentId === candidate.documentId || allowEnded && session.documentId === null) && session.grantId === grantId
      ? { documentId: candidate.documentId, session, tabId: candidate.tab.id }
      : null;
  };

  browser.runtime.onMessage.addListener((message, sender) => {
    if (isInvalidateGrantMessage(message)) {
      return authorizedSender(sender, message.grantId).then(async (authorized) => {
        if (authorized === null) return;
        await enqueueTab(authorized.tabId, async () => {
          const session = await readTabSession(authorized.tabId);
          if (session?.id !== authorized.session.id || session.grantId !== message.grantId) return;
          if (message.result !== null) {
            const previous: StoredRunResult = { documentId: authorized.documentId, page: message.page, result: message.result, state: "previous", tabSessionId: session.id };
            await browser.storage.session.set({ [runResultStorageKey(session.id)]: previous });
          } else {
            const result = await readRunResult(session.id);
            if (result !== null) await browser.storage.session.set({ [runResultStorageKey(session.id)]: { ...result, state: "previous" } });
          }
          await writeTabSession(authorized.tabId, { ...session, documentId: null });
          await showRunActivity(authorized.tabId, false);
        });
      });
    }
    if (isRunActivityMessage(message)) {
      void authorizedSender(sender, message.grantId).then((authorized) => {
        if (authorized !== null) {
          return enqueueTab(authorized.tabId, async () => {
            const session = await readTabSession(authorized.tabId);
            if (session?.id !== authorized.session.id || session.grantId !== message.grantId) return;
            await showRunActivity(authorized.tabId, message.active);
          });
        }
      });
      return;
    }
    if (isStoreRunResultMessage(message)) {
      return authorizedSender(sender, message.grantId).then(async (authorized) => {
        if (authorized === null) return;
        let saved = false;
        await enqueueTab(authorized.tabId, async () => {
          const session = await readTabSession(authorized.tabId);
          if (
            session?.id !== authorized.session.id ||
            session.documentId !== authorized.documentId || session.grantId !== message.grantId
          ) return;
          const result: StoredRunResult = {
            documentId: authorized.documentId,
            page: message.page,
            result: message.result,
            state: message.type === storePreviousRunResultMessageType ? "previous" : "current",
            tabSessionId: authorized.session.id,
          };
          await browser.storage.session.set({ [runResultStorageKey(authorized.session.id)]: result });
          saved = true;
        });
        return saved;
      });
    }
    if (isReadRunResultMessage(message)) {
      return authorizedSender(sender, message.grantId, true).then(async (authorized) => {
        if (authorized === null) return null;
        let previous: StoredRunResult | null = null;
        await enqueueTab(authorized.tabId, async () => {
          const session = await readTabSession(authorized.tabId);
          if (session?.id !== authorized.session.id || session.grantId !== message.grantId) return;
          const result = await readRunResult(authorized.session.id);
          previous = result?.state === "previous" ? result : null;
        });
        return previous;
      });
    }
    if (isClearRunResultMessage(message)) {
      void authorizedSender(sender, message.grantId, true).then((authorized) => {
        if (authorized !== null) {
          return enqueueTab(authorized.tabId, async () => {
            const session = await readTabSession(authorized.tabId);
            if (session?.id === authorized.session.id && session.grantId === message.grantId) {
              await browser.storage.session.remove(runResultStorageKey(authorized.session.id));
            }
          });
        }
      });
    }
  });

  browser.action.onClicked.addListener(async (tab) => {
    await reconciled;
    let response = await authorizeTargetPage(tab);
    let grantId: string | null = null;
    if (response.status === "authorized" && tab.id !== undefined) {
      const session = await ensureTabSession(tab.id);
      const result = await readRunResult(session.id);
      if (result !== null && (result.documentId !== response.documentId || session.documentId === null)) {
        await browser.storage.session.set({
          [runResultStorageKey(session.id)]: { ...result, state: "previous" },
        });
      }
      grantId = crypto.randomUUID();
      await writeTabSession(tab.id, { ...session, documentId: response.documentId, grantId });
    }
    if (response.status === "authorized" && tab.id !== undefined && grantId !== null) {
      const mounted = await mountTargetPageControlShell(tab.id, response.documentId, grantId);
      if (mounted !== "mounted") response = rejectTargetAuthorization(mounted === "reload-required" ? "reload-required" : "ui-mount-failed");
    }
    if (tab.id !== undefined) {
      if (grantId !== null && (await readTabSession(tab.id))?.grantId !== grantId) return;
      if (response.status !== "authorized") {
        const session = await readTabSession(tab.id);
        if (session !== null) await writeTabSession(tab.id, { ...session, documentId: null });
      }
      await showAuthorizationFeedback(tab.id, response);
    }
  });
});
