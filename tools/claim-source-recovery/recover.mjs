#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parse } from "acorn";
import prettier from "prettier";

const DEFAULT_ORIGIN = "https://claim.superfluid.org";
const DEFAULT_ROUTES = [
  "/",
  "/claim",
  "/campaigns",
  "/leaderboard",
  "/reserve",
  "/reserve-names",
  "/governance",
  "/staking",
  "/liquidity",
];

function parseArgs(argv) {
  const out = {
    origin: DEFAULT_ORIGIN,
    outDir: "recovered/claim.superfluid.org",
    routes: DEFAULT_ROUTES,
    captureDir: null,
    maxAssets: 2000,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--origin") out.origin = argv[++i];
    else if (arg === "--out") out.outDir = argv[++i];
    else if (arg === "--capture") out.captureDir = argv[++i];
    else if (arg === "--routes") out.routes = argv[++i].split(",").map((x) => x.trim()).filter(Boolean);
    else if (arg === "--max-assets") out.maxAssets = Number(argv[++i]);
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: recover.mjs [--origin URL] [--out DIR] [--capture DIR] [--routes CSV] [--max-assets N]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

const hash = (text) => createHash("sha256").update(text).digest("hex");
const normalizeUrl = (url) => {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.href;
};

function safePath(input) {
  return (
    input
      .replace(/^webpack:\/\//, "webpack/")
      .replace(/^file:\/\//, "file/")
      .replace(/^https?:\/\//, "remote/")
      .replace(/^\/+/, "")
      .replace(/[<>:"|?*\x00-\x1f]/g, "_")
      .split("/")
      .filter((part) => part && part !== "." && part !== "..")
      .join("/") || "unnamed-source.js"
  );
}

function assetPath(url) {
  const parsed = new URL(url);
  const suffix = parsed.search ? `__q_${hash(parsed.search).slice(0, 10)}` : "";
  return `${safePath(parsed.pathname)}${suffix}`;
}

async function pretty(code, filepath = "module.js") {
  try {
    return await prettier.format(code, {
      parser: "babel",
      filepath,
      printWidth: 100,
      semi: true,
      trailingComma: "all",
    });
  } catch {
    return code;
  }
}

async function fetchText(url, init = {}) {
  const response = await fetch(url, {
    redirect: "follow",
    ...init,
    headers: {
      accept: "text/html,application/javascript,application/json,text/plain,*/*",
      "user-agent": "sup-remission-claim-source-recovery/2.0",
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return {
    text: await response.text(),
    finalUrl: response.url,
    contentType: response.headers.get("content-type") ?? "",
  };
}

const routeName = (route) =>
  route === "/" ? "index.html" : `${route.replace(/^\//, "").replaceAll("/", "__")}.html`;

async function loadRoute(options, route) {
  if (!options.captureDir) return fetchText(new URL(route, options.origin).href);
  return {
    text: await readFile(path.join(options.captureDir, "pages", routeName(route)), "utf8"),
    finalUrl: new URL(route, options.origin).href,
    contentType: "text/html",
  };
}

async function loadAsset(options, url) {
  if (!options.captureDir) return fetchText(url);
  return {
    text: await readFile(path.join(options.captureDir, "assets", assetPath(url)), "utf8"),
    finalUrl: url,
    contentType: url.includes(".map") ? "application/json" : "application/javascript",
  };
}

function collectAssets(text, baseUrl) {
  const urls = new Set();
  const patterns = [
    /(?:src|href)=["']([^"']+)["']/giu,
    /["'`](\/?_next\/static\/[^"'`\\\s]+?\.js(?:\?[^"'`\\\s]*)?)["'`]/giu,
    /["'`](\/?_next\/static\/[^"'`\\\s]+?\.css(?:\?[^"'`\\\s]*)?)["'`]/giu,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const candidate = match[1];
      if (!candidate?.includes("/_next/static/") || !/\.(?:js|css)(?:\?|$)/iu.test(candidate)) continue;
      try {
        urls.add(normalizeUrl(new URL(candidate, baseUrl).href));
      } catch {
        // Ignore malformed strings in minified dependencies.
      }
    }
  }
  return urls;
}

function mapCandidates(js, chunkUrl) {
  const urls = [];
  const explicit = js.match(/\/\/[#@]\s*sourceMappingURL=([^\s]+)/u)?.[1];
  if (explicit) {
    try {
      urls.push(normalizeUrl(new URL(explicit, chunkUrl).href));
    } catch {}
  }
  const fallback = new URL(chunkUrl);
  fallback.search = "";
  fallback.pathname = `${fallback.pathname}.map`;
  urls.push(fallback.href);
  return [...new Set(urls)];
}

function hints(code) {
  const rules = [
    ["points-states", /\/api\/points\/states/u],
    ["points-claim", /\/api\/points\/claim/u],
    ["signed-balance", /signed-balance-batch/u],
    ["programs", /\/api\/programs|getProgramApps/u],
    ["leaderboard", /\/api\/leaderboard|leaderboard/iu],
    ["mystery-box", /mystery.?box/iu],
    ["reserve", /reserve|locker/iu],
    ["staking", /stak(?:e|ing)/iu],
    ["liquidity", /liquidity|\bLP\b/u],
    ["governance", /governance|delegate/iu],
    ["wallet", /wagmi|walletconnect|connectWallet/iu],
    ["superfluid", /superfluid|flowRate|GDA|CFA/u],
    ["contracts", /0x[a-fA-F0-9]{40}/u],
    ["ui", /className|jsx|react/iu],
  ];
  return rules.filter(([, pattern]) => pattern.test(code)).map(([name]) => name);
}

function propertyName(property) {
  if (property.key.type === "Identifier") return property.key.name;
  if (property.key.type === "Literal") return String(property.key.value);
  return null;
}

function moduleObjects(ast) {
  const found = [];
  const stack = [ast];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (node.type === "CallExpression" && node.callee?.type === "MemberExpression") {
      const key = node.callee.property;
      const isPush =
        (!node.callee.computed && key?.type === "Identifier" && key.name === "push") ||
        (node.callee.computed && key?.type === "Literal" && key.value === "push");
      const first = node.arguments?.[0];
      if (isPush && first?.type === "ArrayExpression") {
        for (const element of first.elements ?? []) if (element?.type === "ObjectExpression") found.push(element);
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) stack.push(...value);
      else if (value && typeof value === "object" && typeof value.type === "string") stack.push(value);
    }
  }
  return found;
}

async function synthesize(js, chunkName, root) {
  let ast;
  try {
    ast = parse(js, {
      ecmaVersion: "latest",
      sourceType: "script",
      allowHashBang: true,
      allowAwaitOutsideFunction: true,
    });
  } catch (error) {
    return { records: [], parseError: String(error) };
  }
  const records = [];
  const seen = new Set();
  for (const object of moduleObjects(ast)) {
    for (const property of object.properties ?? []) {
      if (property.type !== "Property") continue;
      const id = propertyName(property);
      const fn = property.value;
      if (!id || !Number.isInteger(fn?.start) || !Number.isInteger(fn?.end)) continue;
      const key = `${id}:${fn.start}:${fn.end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const raw = js.slice(fn.start, fn.end);
      const inferred = hints(raw);
      const label = inferred.slice(0, 4).join("-") || "module";
      const rel = path.join("synthesized", safePath(chunkName.replace(/\.js$/u, "")), `${safePath(id)}-${label}.js`);
      const file = path.join(root, rel);
      await mkdir(path.dirname(file), { recursive: true });
      const header = `// Reconstructed webpack module ${id} from ${chunkName}.\n// Function body and literals are recovered from the deployed bundle.\n// Names, imports, exports, comments, and original boundaries may differ.\n${inferred.length ? `// Inferred concerns: ${inferred.join(", ")}.\n` : ""}`;
      await writeFile(file, await pretty(`${header}export default ${raw};\n`, file));
      records.push({ moduleId: id, file: rel, hints: inferred, bytes: Buffer.byteLength(raw), sha256: hash(raw) });
    }
  }
  return { records, parseError: null };
}

async function recoverMap(mapText, chunkName, root) {
  const map = JSON.parse(mapText);
  const records = [];
  for (let i = 0; i < (map.sources ?? []).length; i += 1) {
    if (typeof map.sourcesContent?.[i] !== "string") continue;
    const rel = path.join("original", safePath(chunkName.replace(/\.js$/u, "")), safePath(map.sources[i]));
    const file = path.join(root, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, map.sourcesContent[i]);
    records.push({ source: map.sources[i], file: rel, bytes: Buffer.byteLength(map.sourcesContent[i]), sha256: hash(map.sourcesContent[i]) });
  }
  return { records, sourceCount: map.sources?.length ?? 0, sourceRoot: map.sourceRoot ?? null };
}

async function saveRaw(root, category, url, text) {
  const rel = path.join("raw", category, assetPath(url));
  const file = path.join(root, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
  return rel;
}

async function processJs(options, root, url, js) {
  const chunkName = new URL(url).pathname.split("/").pop() || `chunk-${hash(url).slice(0, 10)}.js`;
  const prettyRel = path.join("beautified", assetPath(url));
  const prettyFile = path.join(root, prettyRel);
  await mkdir(path.dirname(prettyFile), { recursive: true });
  await writeFile(prettyFile, await pretty(js, chunkName));

  let map = null;
  const mapErrors = [];
  for (const mapUrl of mapCandidates(js, url)) {
    try {
      const { text } = await loadAsset(options, mapUrl);
      map = { url: mapUrl, file: await saveRaw(root, "maps", mapUrl, text), ...(await recoverMap(text, chunkName, root)) };
      break;
    } catch (error) {
      mapErrors.push({ url: mapUrl, error: String(error) });
    }
  }
  const synthesized = map?.records.length ? { records: [], parseError: null } : await synthesize(js, chunkName, root);
  return { chunkName, beautifiedFile: prettyRel, map, mapErrors, synthesized: synthesized.records, parseError: synthesized.parseError };
}

async function main() {
  const options = parseArgs(process.argv);
  const root = path.resolve(options.outDir);
  await mkdir(root, { recursive: true });
  const queue = [];
  const queued = new Set();
  const routes = [];
  const assets = [];

  const enqueue = (url, discoveredFrom) => {
    const normalized = normalizeUrl(url);
    if (queued.has(normalized)) return;
    if (queued.size >= options.maxAssets) throw new Error(`Asset safety cap exceeded (${options.maxAssets})`);
    queued.add(normalized);
    queue.push({ url: normalized, discoveredFrom });
  };

  for (const route of options.routes) {
    const response = await loadRoute(options, route);
    const url = response.finalUrl || new URL(route, options.origin).href;
    const rel = path.join("raw", "pages", routeName(route));
    const file = path.join(root, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, response.text);
    const discovered = [...collectAssets(response.text, url)];
    discovered.forEach((asset) => enqueue(asset, `route:${route}`));
    routes.push({ route, url, file: rel, bytes: Buffer.byteLength(response.text), sha256: hash(response.text), assets: discovered });
  }

  while (queue.length) {
    const item = queue.shift();
    try {
      const response = await loadAsset(options, item.url);
      const js = /javascript|ecmascript/iu.test(response.contentType) || /\.js(?:\?|$)/iu.test(item.url);
      const css = /text\/css/iu.test(response.contentType) || /\.css(?:\?|$)/iu.test(item.url);
      const nested = collectAssets(response.text, response.finalUrl || item.url);
      nested.forEach((asset) => enqueue(asset, item.url));
      const record = {
        url: item.url,
        finalUrl: response.finalUrl,
        discoveredFrom: item.discoveredFrom,
        contentType: response.contentType,
        file: await saveRaw(root, css ? "styles" : "chunks", item.url, response.text),
        bytes: Buffer.byteLength(response.text),
        sha256: hash(response.text),
        nestedAssets: [...nested],
      };
      if (js) Object.assign(record, await processJs(options, root, item.url, response.text));
      assets.push(record);
      console.error(`recovered ${item.url}: ${record.map?.records.length ?? 0} originals, ${record.synthesized?.length ?? 0} synthesized`);
    } catch (error) {
      assets.push({ url: item.url, discoveredFrom: item.discoveredFrom, error: String(error) });
      console.error(`failed ${item.url}: ${error}`);
    }
  }

  const summary = {
    routes: routes.length,
    assets: assets.length,
    successfulAssets: assets.filter((asset) => !asset.error).length,
    failedAssets: assets.filter((asset) => asset.error).length,
    sourceMappedOriginals: assets.reduce((n, asset) => n + (asset.map?.records.length ?? 0), 0),
    synthesizedModules: assets.reduce((n, asset) => n + (asset.synthesized?.length ?? 0), 0),
  };
  const manifest = {
    generatedAt: new Date().toISOString(),
    origin: options.origin,
    acquisition: options.captureDir ? { mode: "capture", directory: options.captureDir } : { mode: "live" },
    routes,
    assets,
    summary,
    provenance: {
      original: "Files under original/ are verbatim sourcesContent entries from source maps published by the deployment.",
      synthesized: "Files under synthesized/ preserve deployed webpack module functions but infer filenames and concerns; they are not literal author source files.",
      beautified: "Files under beautified/ are complete deployed chunks with formatting only.",
      raw: "Files under raw/ are exact fetched pages, chunks, styles, and source maps.",
    },
  };
  await writeFile(path.join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(root, "README.md"), `# claim.superfluid.org source recovery\n\nGenerated: ${manifest.generatedAt}\n\n- Routes captured: ${summary.routes}\n- Assets recovered: ${summary.successfulAssets}/${summary.assets}\n- Source-map originals: ${summary.sourceMappedOriginals}\n- Synthesized webpack modules: ${summary.synthesizedModules}\n\nSee manifest.json for per-file provenance and hashes.\n`);
  console.log(JSON.stringify(summary));
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
