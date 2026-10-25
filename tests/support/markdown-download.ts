// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Browser } from "puppeteer-core";

type Download = { guid: string; suggestedFilename: string; url: string };

/** Observe actual Chrome downloads in a disposable directory, without mocking the file payload. */
export async function observeMarkdownDownloads(browser: Browser) {
  const directory = await mkdtemp(path.join(tmpdir(), "ui-torture-download-"));
  const session = await browser.target().createCDPSession();
  const downloads: Download[] = [];
  try {
    await session.send("Browser.setDownloadBehavior", { behavior: "allowAndName", downloadPath: directory, eventsEnabled: true });
  } catch (error) {
    await session.detach();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  session.on("Browser.downloadWillBegin", entry => downloads.push(entry));
  return {
    count: () => downloads.length,
    async capture(action: () => Promise<void>) {
      const initialCount = downloads.length;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let completed: (event: { guid: string; state: string }) => void = () => undefined;
      const completion = new Promise<Download>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Native Markdown download did not complete")), 5000);
        completed = event => {
          const entry = downloads.slice(initialCount).find(candidate => candidate.guid === event.guid);
          if (entry === undefined) return;
          if (event.state === "completed") resolve(entry);
          if (event.state === "canceled") reject(new Error("Native Markdown download was canceled"));
        };
        session.on("Browser.downloadProgress", completed);
      });
      try {
        const [, entry] = await Promise.all([action(), completion]);
        return { filename: entry.suggestedFilename, url: entry.url, bytes: await readFile(path.join(directory, entry.guid)) };
      } finally {
        clearTimeout(timer);
        session.off("Browser.downloadProgress", completed);
      }
    },
    async dispose() {
      await session.send("Browser.setDownloadBehavior", { behavior: "default" }).catch(() => undefined);
      await session.detach();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
