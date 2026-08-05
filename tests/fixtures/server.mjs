// SPDX-License-Identifier: Apache-2.0

import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.FIXTURE_PORT ?? "4173", 10);
const fixtureRoot = fileURLToPath(new URL("./pages/", import.meta.url));

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
]);

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (requestUrl.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(request.method === "HEAD" ? undefined : "ok");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }

  const relativePath = pathname.endsWith("/")
    ? `${pathname.slice(1)}index.html`
    : pathname.slice(1);
  const filePath = resolve(fixtureRoot, relativePath);
  const pathFromRoot = relative(fixtureRoot, filePath);

  if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) {
    response.writeHead(403).end();
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type":
        contentTypes.get(extname(filePath)) ?? "application/octet-stream",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      response.writeHead(404).end();
      return;
    }

    response.writeHead(500).end();
  }
});

const stop = () => server.close();
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

server.listen(port, host, () => {
  console.log(`Synthetic fixtures available at http://${host}:${port}`);
});
