// SPDX-License-Identifier: Apache-2.0

import ts from "typescript";
import { createHash } from "node:crypto";

const propertyName = (node) => node?.name && (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)) ? node.name.text : null;
const field = (object, name) => object?.properties?.find((entry) => propertyName(entry) === name)?.initializer;
const literal = (node) => node && ts.isStringLiteralLike(node) ? node.text : null;
const array = (node) => node && ts.isArrayLiteralExpression(node) ? node.elements : [];
const equalSet = (a, b) => a.length === b.length && [...a].sort().every((value, i) => value === [...b].sort()[i]);

export function inspectManifest(manifest, contract) {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  check(manifest.manifest_version === 3, "manifest_version must be 3");
  check(manifest.incognito === "not_allowed", "incognito must be not_allowed");
  check(equalSet(manifest.permissions ?? [], contract.permissions), "permissions differ from the fixed public budget");
  check(manifest.minimum_chrome_version === contract.validatedMinimumChrome, "minimum_chrome_version differs from the validated floor");
  for (const key of ["host_permissions", "optional_host_permissions", "optional_permissions", "content_scripts", "web_accessible_resources", "externally_connectable", "sandbox", "devtools_page", "side_panel", "chrome_url_overrides", "declarative_net_request", "content_security_policy"]) check(!(key in manifest), `${key} is not authorized`);
  check(manifest.background?.service_worker === "background.js" && !manifest.background?.scripts && !manifest.background?.page, "background must use the local background.js worker");
  check(!manifest.action?.default_popup, "toolbar authorization must not use a popup");
  check(/^\d+\.\d+\.\d+(?:\.\d+)?$/u.test(manifest.version ?? ""), "manifest version is not traceable");
  return errors;
}

// Fingerprint a complete enclosing renderer function, preserving properties, literals, and control flow.
// Normalize only local/minified identifier spelling so unrelated application edits do not change the review.
export function scriptCreatorFingerprint(node) {
  let owner = node.parent;
  while (owner && !ts.isFunctionLike(owner)) owner = owner.parent;
  if (!owner) return null;
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, owner.getText());
  const names = new Map();
  const tokens = [];
  let previous;
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    let value = scanner.getTokenText();
    if (token === ts.SyntaxKind.Identifier && previous !== ts.SyntaxKind.DotToken && previous !== ts.SyntaxKind.QuestionDotToken && scanner.lookAhead(() => scanner.scan()) !== ts.SyntaxKind.ColonToken) {
      if (!names.has(value)) names.set(value, `identifier${names.size}`);
      value = names.get(value);
    }
    tokens.push(`${token}:${value}`);
    previous = token;
  }
  return createHash("sha256").update(tokens.join("|")).digest("hex");
}

export function inspectJavaScript(code, { requireInjection = false, firstParty = false, reviewedScriptCreators = [], filename = "artifact.tsx" } = {}) {
  const kind = /\.[jt]sx$/u.test(filename) ? ts.ScriptKind.TSX : filename.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const source = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true, kind);
  const errors = source.parseDiagnostics.slice(0, 3).map((diagnostic) => `syntax: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`);
  const report = (node, message) => errors.push(`line ${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${message}`);
  let injectionCount = 0;
  const usedCreators = new Set();
  const visit = (node) => {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const expression = node.expression;
      const name = ts.isPropertyAccessExpression(expression) ? expression.name.text : ts.isIdentifier(expression) ? expression.text : ts.isElementAccessExpression(expression) ? literal(expression.argumentExpression) : "";
      if (["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "WebTransport", "sendBeacon", "importScripts", "eval", "Function", "captureVisibleTab", "captureTab", "chooseDesktopMedia", "getDisplayMedia", "getUserMedia", "captureStream"].includes(name) || expression.kind === ts.SyntaxKind.ImportKeyword) report(node, `unauthorized runtime capability ${name || "dynamic import"}`);
      if (name === "capture" && /(?:tabCapture|desktopCapture|pageCapture)/u.test(expression.getText(source))) report(node, "media or page capture is not authorized");
      if (name === "CustomEvent") report(node, "CustomEvent page bridge is not authorized");
      if (name === "postMessage" && (!ts.isPropertyAccessExpression(expression) || /^(?:window|self|globalThis)$/u.test(expression.expression.getText(source)))) report(node, "window postMessage bridge is not authorized");
      if (["createElement", "createElementNS"].includes(name) && node.arguments?.some((argument) => literal(argument)?.toLowerCase() === "script")) {
        const fingerprint = scriptCreatorFingerprint(node);
        if (firstParty || !reviewedScriptCreators.includes(fingerprint) || usedCreators.has(fingerprint)) report(node, "script-element injection is not authorized");
        usedCreators.add(fingerprint);
      }
      if (name === "executeScript") {
        injectionCount++;
        const options = node.arguments?.[0];
        const target = field(options, "target");
        if (!options || !ts.isObjectLiteralExpression(options) || options.properties.some(ts.isSpreadAssignment) || literal(field(options, "world")) !== "ISOLATED") report(node, "executeScript must declare a literal ISOLATED world");
        const frames = field(target, "frameIds");
        const documents = field(target, "documentIds");
        const validFrame = array(frames).length === 1 && array(frames)[0]?.getText(source) === "0" && !documents;
        const validDocument = array(documents).length === 1 && !frames;
        if (!target || !ts.isObjectLiteralExpression(target) || target.properties.some((entry) => !["tabId", "frameIds", "documentIds"].includes(propertyName(entry))) || !target.properties.some((entry) => propertyName(entry) === "tabId") || !(validFrame || validDocument)) report(node, "executeScript must target one main frame or one verified Document ID");
        const files = field(options, "files");
        if (files && (array(files).length !== 1 || literal(array(files)[0]) !== "/document-runtime.js")) report(node, "unapproved injected file");
      }
      if (["defineProperty", "assign"].includes(name) && /\bhistory\b/u.test(node.arguments?.[0]?.getText(source) ?? "")) report(node, "History monkey patch is not authorized");
    }
    if (ts.isBinaryExpression(node) && ts.isAssignmentOperator(node.operatorToken.kind) && /(?:\.|\[\s*["'`])(?:pushState|replaceState)/u.test(node.left.getText(source))) report(node, "History monkey patch is not authorized");
    if (firstParty && ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ["script", "iframe"].includes(node.tagName.getText(source)))) report(node, "executable or embedded JSX is not authorized");
    if (firstParty && ts.isImportDeclaration(node) && literal(node.moduleSpecifier) === "react-dom") report(node, "first-party React DOM resource APIs require a separate review");
    if (firstParty && ts.isIdentifier(node) && ["localStorage", "sessionStorage", "indexedDB", "__NEXT_DATA__", "__VUE__", "__REACT_DEVTOOLS_GLOBAL_HOOK__"].includes(node.text)) report(node, `unapproved first-party storage or framework inspection ${node.text}`);
    if (ts.isCallExpression(node) && /\.storage\.(?:local|sync)\./u.test(node.expression.getText(source))) report(node, "persistent or synchronized storage is not authorized");
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (requireInjection && injectionCount !== 4) errors.push(`expected four reviewed toolbar injections, found ${injectionCount}`);
  return errors;
}

export function inspectSiteFile(filename, contents) {
  const errors = [];
  if (!/\.(?:html|css|txt|svg|ico|png|webp|woff2)$/u.test(filename) || /(?:^|\/)(?:_worker|functions|server|api)(?:[./]|$)/u.test(filename)) errors.push("non-static or unapproved website artifact");
  if (/\.(?:html|svg)$/u.test(filename)) {
    if (/<(?:script|iframe|form|foreignObject)\b|astro-island|\bon[a-z]+\s*=/iu.test(contents)) errors.push("script, hydration, embed, form, or inline handler in generated HTML");
    for (const [, url] of contents.matchAll(/(?:src|srcset|href)\s*=\s*["']([^"']+)["']/giu)) {
      if (url.startsWith("//") || /^(?:javascript|data):/iu.test(url)) errors.push(`unsafe asset or navigation URL ${url}`);
    }
    for (const match of contents.matchAll(/<(?:link|img|source|video|audio)\b[^>]*>/giu)) {
      if (/\b(?:src|srcset|href)\s*=\s*["'][^"']*(?:https?:)?\/\//iu.test(match[0]) && !/rel="canonical"/u.test(match[0])) errors.push("third-party runtime asset");
    }
    if (/http-equiv=["']refresh/iu.test(contents)) errors.push("automatic redirect in generated HTML");
  }
  if (/url\(\s*["']?(?:https?:|\/\/)|@import\b/iu.test(contents)) errors.push("remote stylesheet or runtime asset");
  return errors;
}

export function inspectProvenance(contents) {
  const patterns = [
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u, "private key material"],
    [/\b(?:gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{60,}|AKIA[A-Z0-9]{16})\b/u, "credential-shaped value"],
    [/https?:\/\/[^/\s:@]+:[^/\s@]+@/u, "URL with embedded credentials"],
    [/https?:\/\/(?:10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|[^/\s]+\.(?:corp|internal))\b/u, "private network URL"],
  ];
  return patterns.filter(([pattern]) => pattern.test(contents)).map(([, message]) => message);
}

export function inspectReleaseReadiness({ contract, gates, version, clean, node, declaredNode, siteOrigin, tagMatches }) {
  const errors = [];
  if (version === "0.0.0" || !/^\d+\.\d+\.\d+(?:\.\d+)?$/u.test(version)) errors.push("set an intentional release version");
  if (!clean) errors.push("release requires a clean public checkout");
  if (node !== declaredNode) errors.push(`release Node must equal ${declaredNode}`);
  if (!tagMatches) errors.push("release tag must identify HEAD and match the manifest version");
  if (!contract.siteOrigin || !/^https:\/\/[^/]+$/u.test(contract.siteOrigin) || /localhost|\.invalid|127\.0\.0\.1/u.test(contract.siteOrigin) || siteOrigin !== contract.siteOrigin) errors.push("SITE_URL must match the verified official HTTPS origin");
  if (!contract.storeListing || !/^https:\/\/chromewebstore\.google\.com\/detail\/[^/]+\/[a-p]{32}$/u.test(contract.storeListing)) errors.push("record the verified canonical Chrome Web Store listing");
  for (const key of ["technicalValidation", "productValidation", "siteDeployment", "sourceProtection"]) if (gates[key] !== "passed") errors.push(`unresolved launch gate: ${key}`);
  return errors;
}
