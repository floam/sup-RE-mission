#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parse } from "acorn";
import prettier from "prettier";

const DEFAULT_ORIGIN = "https://claim.superfluid.org";
const DEFAULT_ROUTES = [
  "/",
  "/reserve",
  "/claim",
  "/apps",
  "/leaderboard",
  "/governance",
  "/staking",
  "/liquidity",
];

function parseArgs(argv) {
  const options = {
    origin: DEFAULT_ORIGIN,
    outDir: "recovered/claim.superfluid.org",
    routes: DEFAULT_ROUTES,
    captureDir: null,
    maxAssets: 2000,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--origin") options.origin = argv[++index];
    else if (argument === "--out") options.outDir = argv[++index];
    else if (argument === "--capture") options.captureDir = argv[++index];
    else if (argument === "--routes") {
      options.routes = argv[++index]
        .split(",")
        .map((route) => route.trim())
        .filter(Boolean);
    } else if (argument === "--max-assets") options.maxAssets = Number(argv[++index]);
    else if (argument === "--help" || argument === "-h") {
      console.log(`Usage: node tools/claim-source-recovery/recover.mjs [options]

Options:
  --origin URL       Site origin (default: ${DEFAULT_ORIGIN})
  --out DIR          Output directory
  --capture DIR      Read a previously captured site tree instead of the network
  --routes CSV       Comma-separated routes
  --max-assets N     Safety cap for recursively discovered assets
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeUrl(url) {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.href;
}

function safePath(value) {
  const cleaned = value
    .replace(/^webpack:\/\//, "webpack/")
    .replace(/^file:\/\//, "file/")
    .replace(/^https?:\/\//, "remote/")
    .replace(/^\/+/, "")
    .replace(/[<>:"|?*\x00-\x1f]/g, "_")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
  return cleaned || "unnamed-source.js";
}

function assetFileName(url) {
  const parsed = new URL(url);
  const pathname = parsed.pathname.replace(/^\/+/, "");
  const suffix = parsed.search ? `__q_${sha256(parsed.search).slice(0, 10)}` : "";
  return `${safePath(pathname)}${suffix}`;
}

async function formatCode(code, filepath = "module.js") {
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

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }

  return {
    text: await response.text(),
    finalUrl: response.url,
    contentType: response.headers.get("content-type") ?? "",
    headers: Object.fromEntries(response.headers.entries()),
  };
}

function routeCaptureName(route) {
  return route === "/" ? "index.html" : `${route.replace(/^\//, "").replaceAll("/", "__")}.html`;
}

async function loadRoute(options, route) {
  if (!options.captureDir) {
    return fetchText(new URL(route, options.origin).href);
  }

  const filename = path.join(options.captureDir, "pages", routeCaptureName(route));
  return {
    text: await readFile(filename, "utf8"),
    finalUrl: new URL(route, options.origin).href,
    contentType: "text/html",
    headers: {},
  };
}

async function loadAsset(options, url) {
  if (!options.captureDir) return fetchText(url);
  const filename = path.join(options.captureDir, "assets", assetFileName(url));
  const pathname = new URL(url).pathname;
  const contentType = pathname.endsWith(".css")
    ? "text/css"
    : pathname.endsWith(".map")
      ? "application/json"
      : "application/javascript";
  return {
    text: await readFile(filename, "utf8"),
    finalUrl: url,
    contentType,
    headers: {},
  };
}

function collectNextAssets(text, baseUrl) {
  const urls = new Set();
  const patterns = [
    /(?:src|href)=["']([^"']+)["']/giu,
    /["'`](\/?_next\/static\/[^"'`\\\s]+?\.js(?:\?[^"'`\\\s]*)?)["'`]/giu,
    /["'`](\/?_next\/static\/[^"'`\\\s]+?\.css(?:\?[^"'`\\\s]*)?)["'`]/giu,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const candidate = match[1];
      if (!candidate || !candidate.includes("/_next/static/")) continue;
      if (!/\.(?:js|css)(?:\?|$)/iu.test(candidate)) continue;
      try {
        urls.add(normalizeUrl(new URL(candidate, baseUrl).href));
      } catch {
        // Ignore malformed strings from minified third-party modules.
      }
    }
  }

  return urls;
}

function sourceMapCandidates(js, chunkUrl) {
  const urls = [];
  const explicit = js.match(/\/\/[#@]\s*sourceMappingURL=([^\s]+)/u)?.[1];
  if (explicit) {
    try {
      urls.push(normalizeUrl(new URL(explicit, chunkUrl).href));
    } catch {
      // Ignore malformed source map comments.
    }
  }

  const parsed = new URL(chunkUrl);
  parsed.search = "";
  parsed.hash = "";
  parsed.pathname = `${parsed.pathname}.map`;
  urls.push(parsed.href);
  return [...new Set(urls)];
}

function inferHints(code) {
  const checks = [
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
  return checks.filter(([, pattern]) => pattern.test(code)).map(([name]) => name);
}

function propertyName(property) {
  if (property.computed && property.key.type === "Literal") return String(property.key.value);
  if (property.key.type === "Identifier") return property.key.name;
  if (property.key.type === "Literal") return String(property.key.value);
  return null;
}

function findWebpackModuleObjects(ast) {
  const objects = [];
  const stack = [ast];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;

    if (node.type === "CallExpression" && node.callee?.type === "MemberExpression") {
      const method = node.callee.property;
      const isPush =
        (!node.callee.computed && method?.type === "Identifier" && method.name === "push") ||
        (node.callee.computed && method?.type === "Literal" && method.value === "push");
      const first = node.arguments?.[0];
      if (isPush && first?.type === "ArrayExpression") {
        for (const element of first.elements ?? []) {
          if (element?.type === "ObjectExpression") objects.push(element);
        }
      }
    }

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) stack.push(...value);
      else if (value && typeof value === "object" && typeof value.type === "string") stack.push(value);
    }
  }
  return objects;
}

async function synthesizeWebpackModules(js, chunkName, outputRoot) {
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
  for (const object of findWebpackModuleObjects(ast)) {
    for (const property of object.properties ?? []) {
      if (property.type !== "Property") continue;
      const moduleId = propertyName(property);
      const fn = property.value;
      if (!moduleId || !fn || !Number.isInteger(fn.start) || !Number.isInteger(fn.end)) continue;
      const uniqueKey = `${moduleId}:${fn.start}:${fn.end}`;
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);

      const raw = js.slice(fn.start, fn.end);
      const hints = inferHints(raw);
      const label = hints.slice(0, 4).join("-") || "module";
      const relative = path.join(
        "synthesized",
        safePath(chunkName.replace(/\.js$/u, "")),
        `${safePath(moduleId)}-${label}.js`,
      );
      const filename = path.join(outputRoot, relative);
      await mkdir(path.dirname(filename), { recursive: true });

      const header = [
        `// Reconstructed webpack module ${moduleId} from ${chunkName}.`,
        "// The function body and literals are recovered from the deployed bundle.",
        "// Names, imports, exports, comments, and original file boundaries may differ.",
        hints.length ? `// Inferred concerns: ${hints.join(", ")}.` : null,
        "",
      ]
        .filter((line) => line !== null)
        .join("\n");

      const wrapped = `${header}export default ${raw};\n`;
      await writeFile(filename, await formatCode(wrapped, filename));
      records.push({
        moduleId,
        file: relative,
        hints,
        bytes: Buffer.byteLength(raw),
        sha256: sha256(raw),
      });
    }
  }

  return { records, parseError: null };
}

async function recoverSourceMap(mapText, chunkName, outputRoot) {
  const map = JSON.parse(mapText);
  const records = [];
  const sources = map.sources ?? [];
  const contents = map.sourcesContent ?? [];

  for (let index = 0; index < sources.length; index += 1) {
    if (typeof contents[index] !== "string") continue;
    const relative = path.join(
      "original",
      safePath(chunkName.replace(/\.js$/u, "")),
      safePath(sources[index]),
    );
    const filename = path.join(outputRoot, relative);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, contents[index]);
    records.push({
      source: sources[index],
      file: relative,
      bytes: Buffer.byteLength(contents[index]),
      sha256: sha256(contents[index]),
    });
  }

  return {
    records,
    sourceRoot: map.sourceRoot ?? null,
    sourceCount: sources.length,
    hasSourcesContent: contents.some((content) => typeof content === "string"),
  };
}

async function saveRaw(outputRoot, category, url, text) {
  const relative = path.join("raw", category, assetFileName(url));
  const filename = path.join(outputRoot, relative);
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, text);
  return relative;
}

async function processJavaScript(options, outputRoot, url, js) {
  const chunkName = new URL(url).pathname.split("/").pop() || `chunk-${sha256(url).slice(0, 10)}.js`;
  const prettyRelative = path.join("beautified", assetFileName(url));
  const prettyFilename = path.join(outputRoot, prettyRelative);
  await mkdir(path.dirname(prettyFilename), { recursive: true });
  await writeFile(prettyFilename, await formatCode(js, chunkName));

  let map = null;
  const mapErrors = [];
  for (const mapUrl of sourceMapCandidates(js, url)) {
    try {
      const { text: mapText } = await loadAsset(options, mapUrl);
      const rawMapFile = await saveRaw(outputRoot, "maps", mapUrl, mapText);
      const recovered = await recoverSourceMap(mapText, chunkName, outputRoot);
      map = { url: mapUrl, file: rawMapFile, ...recovered };
      break;
    } catch (error) {
      mapErrors.push({ url: mapUrl, error: String(error) });
    }
  }

  const synthesized = map?.records.length
    ? { records: [], parseError: null }
    : await synthesizeWebpackModules(js, chunkName, outputRoot);

  return {
    chunkName,
    beautifiedFile: prettyRelative,
    map,
    mapErrors,
    synthesized: synthesized.records,
    parseError: synthesized.parseError,
  };
}

async function main() {
  const options = parseArgs(process.argv);
  const outputRoot = path.resolve(options.outDir);
  // Preserve externally-written diagnostics such as recovery.log, while ensuring a
  // rerun cannot mix recovered source files from different deployments.
  await Promise.all(
    ["raw", "beautified", "original", "synthesized", "manifest.json", "README.md"].map((entry) =>
      rm(path.join(outputRoot, entry), { recursive: true, force: true }),
    ),
  );
  await mkdir(outputRoot, { recursive: true });

  const queue = [];
  const queued = new Set();
  const routeRecords = [];
  const assets = [];

  function enqueue(url, discoveredFrom) {
    const normalized = normalizeUrl(url);
    if (queued.has(normalized)) return;
    if (queued.size >= options.maxAssets) {
      throw new Error(`Asset safety cap exceeded (${options.maxAssets})`);
    }
    queued.add(normalized);
    queue.push({ url: normalized, discoveredFrom });
  }

  for (const route of options.routes) {
    const requestedUrl = new URL(route, options.origin).href;
    try {
      const response = await loadRoute(options, route);
      const routeUrl = response.finalUrl || requestedUrl;
      const routeRelative = path.join("raw", "pages", routeCaptureName(route));
      const routeFilename = path.join(outputRoot, routeRelative);
      await mkdir(path.dirname(routeFilename), { recursive: true });
      await writeFile(routeFilename, response.text);

      const discovered = [...collectNextAssets(response.text, routeUrl)];
      discovered.forEach((url) => enqueue(url, `route:${route}`));
      routeRecords.push({
        route,
        url: routeUrl,
        file: routeRelative,
        bytes: Buffer.byteLength(response.text),
        sha256: sha256(response.text),
        assets: discovered,
      });
    } catch (error) {
      routeRecords.push({ route, url: requestedUrl, error: String(error) });
      console.error(`failed route ${requestedUrl}: ${error}`);
    }
  }

  while (queue.length) {
    const item = queue.shift();
    try {
      const response = await loadAsset(options, item.url);
      const contentType = response.contentType;
      const isJavaScript = /javascript|ecmascript/iu.test(contentType) || /\.js(?:\?|$)/iu.test(item.url);
      const isCss = /text\/css/iu.test(contentType) || /\.css(?:\?|$)/iu.test(item.url);
      const rawFile = await saveRaw(outputRoot, isCss ? "styles" : "chunks", item.url, response.text);

      const nested = collectNextAssets(response.text, response.finalUrl || item.url);
      for (const url of nested) enqueue(url, item.url);

      const record = {
        url: item.url,
        finalUrl: response.finalUrl,
        discoveredFrom: item.discoveredFrom,
        contentType,
        file: rawFile,
        bytes: Buffer.byteLength(response.text),
        sha256: sha256(response.text),
        nestedAssets: [...nested],
      };

      if (isJavaScript) {
        Object.assign(record, await processJavaScript(options, outputRoot, item.url, response.text));
      }
      assets.push(record);
      console.error(
        `recovered ${item.url} (${record.bytes} bytes, ${record.map?.records.length ?? 0} originals, ${record.synthesized?.length ?? 0} synthesized)`,
      );
    } catch (error) {
      assets.push({
        url: item.url,
        discoveredFrom: item.discoveredFrom,
        error: String(error),
      });
      console.error(`failed ${item.url}: ${error}`);
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    origin: options.origin,
    acquisition: options.captureDir ? { mode: "capture", directory: options.captureDir } : { mode: "live" },
    routes: routeRecords,
    assets,
    summary: {
      attemptedRoutes: routeRecords.length,
      successfulRoutes: routeRecords.filter((route) => !route.error).length,
      failedRoutes: routeRecords.filter((route) => route.error).length,
      // Keep this legacy field successful-only so "Routes" never counts an
      // error-only route record as a captured page.
      routes: routeRecords.filter((route) => !route.error).length,
      assets: assets.length,
      successfulAssets: assets.filter((asset) => !asset.error).length,
      failedAssets: assets.filter((asset) => asset.error).length,
      sourceMappedOriginals: assets.reduce((sum, asset) => sum + (asset.map?.records.length ?? 0), 0),
      synthesizedModules: assets.reduce((sum, asset) => sum + (asset.synthesized?.length ?? 0), 0),
    },
    provenance: {
      original:
        "Files under original/ are verbatim sourcesContent entries from source maps published by the deployment.",
      synthesized:
        "Files under synthesized/ preserve deployed webpack module functions but infer filenames and concerns. They are not literal author source files.",
      beautified:
        "Files under beautified/ are complete deployed chunks with formatting only.",
      raw: "Files under raw/ are the exact fetched pages, chunks, styles, and source maps.",
    },
  };

  await writeFile(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(
    path.join(outputRoot, "README.md"),
    `# claim.superfluid.org source recovery\n\nGenerated: ${manifest.generatedAt}\n\n- Routes captured: ${manifest.summary.successfulRoutes}/${manifest.summary.attemptedRoutes}\n- Failed routes: ${manifest.summary.failedRoutes}\n- Assets recovered: ${manifest.summary.successfulAssets}/${manifest.summary.assets}\n- Source-map originals: ${manifest.summary.sourceMappedOriginals}\n- Synthesized webpack modules: ${manifest.summary.synthesizedModules}\n\nSee \`manifest.json\` for per-file provenance and hashes.\n`,
  );

  console.log(JSON.stringify(manifest.summary));
  if (manifest.summary.failedAssets > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
