// SPDX-License-Identifier: Apache-2.0

import type { TargetAuthorizationResponse } from "./messages";
import { browser } from "wxt/browser";

const feedbackDurationMs = 4_000;
const feedbackTimers = new Map<number, ReturnType<typeof setTimeout>>();

const clearFeedback = async (tabId: number): Promise<void> => {
  await Promise.all([
    browser.action.setBadgeText({ tabId, text: "" }),
    browser.action.setTitle({ tabId, title: "Open UI Torture Lab" }),
  ]);
  feedbackTimers.delete(tabId);
};

export async function showAuthorizationFeedback(
  tabId: number,
  response: TargetAuthorizationResponse,
): Promise<void> {
  const existingTimer = feedbackTimers.get(tabId);
  if (existingTimer !== undefined) {
    clearTimeout(existingTimer);
  }

  const accepted = response.status === "authorized";
  await Promise.all([
    browser.action.setBadgeBackgroundColor({
      tabId,
      color: accepted ? "#16794b" : "#b42318",
    }),
    browser.action.setBadgeText({ tabId, text: accepted ? "OK" : "!" }),
    browser.action.setTitle({
      tabId,
      title: accepted ? "UI Torture Lab — Target Page authorized" : response.message,
    }),
  ]);

  feedbackTimers.set(
    tabId,
    setTimeout(() => {
      void clearFeedback(tabId);
    }, feedbackDurationMs),
  );
}

export async function showRunActivity(
  tabId: number,
  active: boolean,
): Promise<void> {
  const timer = feedbackTimers.get(tabId);
  if (timer !== undefined) {
    clearTimeout(timer);
    feedbackTimers.delete(tabId);
  }
  if (!active) {
    await clearFeedback(tabId);
    return;
  }
  await Promise.all([
    browser.action.setBadgeBackgroundColor({ tabId, color: "#16794b" }),
    browser.action.setBadgeText({ tabId, text: "RUN" }),
    browser.action.setTitle({ tabId, title: "UI Torture Lab — Scenario active" }),
  ]);
}
