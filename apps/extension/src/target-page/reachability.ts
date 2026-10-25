// SPDX-License-Identifier: Apache-2.0

import { browser, type Browser } from "wxt/browser";
import { isBindGrantMessage, runtimePortName } from "./messages";
import { showRunActivity } from "./feedback";

type Connection = {
  readonly grantId: string;
  port: Browser.runtime.Port | null;
  active: boolean;
  reachable: boolean;
};

type WithGrant = (
  sender: unknown,
  grantId: string,
  allowEnded: boolean,
  work: (tabId: number) => Promise<void>,
) => Promise<void>;

/** Transport loss describes reachability; it does not establish Page Exit or BFCache. */
export function createRuntimeReachability(withGrant: WithGrant) {
  const connections = new Map<number, Connection>();
  const markLost = (tabId: number, grantId: string): void => {
    connections.set(tabId, { grantId, port: null, active: false, reachable: false });
  };
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== runtimePortName) return;
    let disconnected = false;
    let bound: { tabId: number; grantId: string } | null = null;
    port.onDisconnect.addListener(() => {
      disconnected = true;
      if (bound === null) return;
      const peer = bound;
      void withGrant(port.sender, peer.grantId, true, async (tabId) => {
        if (connections.get(tabId)?.port !== port) return;
        markLost(tabId, peer.grantId);
        await showRunActivity(tabId, false);
      }).catch(() => undefined);
    });
    port.onMessage.addListener((message) => {
      if (bound !== null || disconnected || !isBindGrantMessage(message)) return;
      void withGrant(port.sender, message.grantId, false, async (tabId) => {
        if (disconnected) return;
        connections.set(tabId, { grantId: message.grantId, port, active: message.active, reachable: true });
        bound = { tabId, grantId: message.grantId };
        try { port.postMessage({ type: "grant-bound", grantId: message.grantId }); } catch { /* Disconnection is handled separately. */ }
        if (message.active) await showRunActivity(tabId, true);
      }).catch(() => undefined);
    });
  });
  return {
    forget: (tabId: number): void => { connections.delete(tabId); },
    markLost,
    isActive: (tabId: number, grantId: string): boolean => {
      const connection = connections.get(tabId);
      return connection?.grantId === grantId && connection.reachable && connection.active;
    },
    report: (tabId: number, grantId: string, active: boolean): boolean => {
      const connection = connections.get(tabId);
      if (active && (connection?.grantId !== grantId || !connection.reachable)) return false;
      if (connection?.grantId === grantId) connection.active = active;
      return true;
    },
  };
}
