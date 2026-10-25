// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const routes = ["/", "/docs/", "/scope/", "/install/", "/privacy/", "/permissions/", "/license/", "/support/"];
const fileFor = (route) => path.join("apps/site/dist", route, "index.html");

test("required static routes expose essential content and consistent canonical metadata", async () => {
  for (const route of routes) {
    const html = await readFile(fileFor(route), "utf8");
    assert.match(html, /<html lang="en"/u, route);
    assert.equal([...html.matchAll(/<h1[\s>]/gu)].length, 1, route);
    for (const pattern of [/<title>[^<]+<\/title>/u, /name="description" content="[^"]+"/u, /<main[^>]*id="content"/u, /Skip to content/u]) assert.match(html, pattern, route);
    const canonical = new URL(/rel="canonical" href="([^"]+)"/u.exec(html)?.[1] ?? "");
    assert.equal(canonical.pathname, route);
    assert.ok(["http:", "https:"].includes(canonical.protocol));
    assert.doesNotMatch(html, /<script\b|<form\b|<iframe\b|astro-island|on(?:click|load)=/iu, route);
    assert.match(html, /Official Distribution is not yet published/u);
    for (const [, link] of html.matchAll(/href="([^"]+)"/gu)) {
      if (!link.startsWith("/") && !link.startsWith("#")) continue;
      const target = new URL(link, canonical);
      const targetFile = target.pathname.endsWith("/") ? fileFor(target.pathname) : path.join("apps/site/dist", target.pathname);
      const body = await readFile(targetFile, "utf8");
      if (target.hash) assert.ok(body.includes(`id="${target.hash.slice(1)}"`), `${route}: missing ${link}`);
    }
  }
});

test("usage and scope disclose implemented capabilities and operational limits", async () => {
  const usage = await readFile(fileFor("/docs/"), "utf8");
  for (const term of ["Run", "Baseline", "Mutation", "Finding", "inconclusive", "Coverage", "Restore", "reload-required", "Current Run Result", "Previous-Target Snapshot", "Markdown Report", "BFCache", "private", "best-effort", "Unknown Mutation State"]) assert.ok(usage.includes(term), term);
  const scope = await readFile(fileFor("/scope/"), "utf8");
  for (const term of ["Google Chrome", "macOS", "Windows", "Linux", "Manifest V3", "HTTP", "HTTPS", "localhost", "iframe", "Shadow DOM", "file:", "data:", "blob:", "Incognito", "Safari", "Firefox", "mobile", "unsupported"]) assert.ok(scope.includes(term), term);
});
