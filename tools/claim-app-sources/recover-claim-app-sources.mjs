#!/usr/bin/env node
/**
 * Inspect the deployed claim application without persisting minified JavaScript.
 * The output is metadata for refreshing research/claim-app-sources/ evidence.
 */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const APP_ORIGIN = "https://claim.superfluid.org";
const SEARCH_TERMS = [
  "getProgramApps",
  "getProgramPoolInfos",
  "/api/points/states",
  "/api/points/claim",
];

function get(url) {
  // Node's fetch is not consistently able to reach this deployment in the
  // investigation environment. curl with HTTP/2 is also the research skill's
  // recommended transport for these endpoints.
  try {
    return execFileSync("curl", [
      "--http2",
      "--fail",
      "--silent",
      "--show-error",
      "--retry",
      "3",
      "--retry-all-errors",
      url,
    ], {
      encoding: "utf8",
      // Some dependency chunks exceed child_process's 1 MiB default buffer.
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(`GET ${url} failed`, { cause: error });
  }
}

function scriptUrls(html) {
  return [...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map(
    ([, source]) => new URL(source, APP_ORIGIN).href,
  );
}

function deploymentId(html) {
  return html.match(/data-dpl-id="([^"]+)"/)?.[1] ?? "not exposed";
}

function unique(values) {
  return [...new Set(values)];
}

function markdownTable(headers, rows, alignments = []) {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => row[column].length)),
  );
  const format = (row) =>
    `| ${row.map((cell, column) => cell.padEnd(widths[column])).join(" | ")} |`;
  const separator = `| ${widths
    .map((width, column) => {
      const alignment = alignments[column] ?? "left";
      if (alignment === "right") return "-".repeat(Math.max(3, width - 1)) + ":";
      return ":" + "-".repeat(Math.max(3, width - 1));
    })
    .join(" | ")} |`;
  return [format(headers), separator, ...rows.map(format)].join("\n");
}

function chunkMetadata(url, source) {
  return {
    chunk: new URL(url).pathname,
    bytes: Buffer.byteLength(source),
    sentryDebugIds: unique(
      [...source.matchAll(/sentryDebugIdIdentifier\s*=\s*"([^"]+)"/g)].map(
        (match) => match[1],
      ),
    ),
    sourceFiles: unique(
      [...source.matchAll(/data-sentry-source-file":"([^"]+)"/g)].map(
        (match) => match[1],
      ),
    ).sort(),
  };
}

function markdownInventory(report) {
  const lines = [
    "# Claim app chunk inventory",
    "",
    "This generated inventory accounts for every JavaScript chunk referenced by the claim-app HTML. It records only human-readable metadata extracted in memory; it does not include minified JavaScript.",
    "",
    markdownTable(
      ["Field", "Value"],
      [
        ["Capture date", report.capturedAt],
        ["Deployment", `\`${report.deployment}\``],
        ["Script chunks referenced", String(report.scriptsExamined)],
        ["Script chunks retrieved", String(report.chunks.length)],
        ["Unavailable chunks", String(report.unavailableChunks.length)],
      ],
    ),
    "",
    "## Chunks",
    "",
    markdownTable(
      ["Chunk", "Bytes", "Sentry debug IDs", "Declared source files"],
      report.chunks.map((chunk) => [
        `\`${chunk.chunk}\``,
        chunk.bytes.toLocaleString("en-US"),
        chunk.sentryDebugIds.map((id) => `\`${id}\``).join("<br>") || "—",
        chunk.sourceFiles.map((name) => `\`${name}\``).join("<br>") || "—",
      ]),
      ["left", "right"],
    ),
  ];
  if (report.unavailableChunks.length) {
    lines.push("", "## Unavailable chunks", "");
    for (const chunk of report.unavailableChunks) lines.push(`- \`${chunk.chunk}\`: ${chunk.error}`);
  }
  return `${lines.join("\n")}\n`;
}

function markdownSourceCatalog(report) {
  const sources = report.chunks.flatMap((chunk) =>
    chunk.sourceFiles.map((sourceFile) => ({ sourceFile, chunk: chunk.chunk })),
  );
  return [
    "# Claim app declared-source catalog",
    "",
    "This generated catalog maps every application source filename exposed by Sentry metadata to its deployed chunk. It is an index for targeted semantic reconstruction; filename-only metadata is not represented as invented source code.",
    "",
    markdownTable(
      ["Source file", "Chunk"],
      sources.map(({ sourceFile, chunk }) => [`\`${sourceFile}\``, `\`${chunk}\``]),
    ),
    "",
  ].join("\n");
}

async function main() {
  const html = get(`${APP_ORIGIN}/`);
  const urls = scriptUrls(html);
  if (urls.length === 0) {
    throw new Error("The claim app HTML did not contain JavaScript chunk URLs.");
  }

  const unavailableChunks = [];
  const chunks = urls.flatMap((url) => {
    try {
      return { url, source: get(url) };
    } catch (error) {
      // Deployments can prune an old hashed chunk while the cached HTML is
      // still served. Keep scanning the remaining chunks and report it.
      unavailableChunks.push({
        chunk: new URL(url).pathname,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  });
  const chunkDetails = chunks.map(({ url, source }) => chunkMetadata(url, source));
  const relevant = chunks
    .map(({ url, source }) => ({
      chunk: new URL(url).pathname,
      terms: SEARCH_TERMS.filter((term) => source.includes(term)),
      serverActions: [
        ...source.matchAll(
          /createServerReference\)\("([0-9a-f]{40,})"[^]*?"([A-Za-z0-9_]+)"\)/g,
        ),
      ].map((match) => ({ id: match[1], name: match[2] })),
    }))
    .filter(({ terms, serverActions }) => terms.length || serverActions.length);

  const report = {
    capturedAt: new Date().toISOString(),
    deployment: deploymentId(html),
    scriptsExamined: urls.length,
    unavailableChunks,
    chunks: chunkDetails,
    relevant,
    note: "No JavaScript chunk was written to disk. Update only human-readable recovered sources.",
  };
  const writeIndex = process.argv.indexOf("--write-inventory");
  if (writeIndex !== -1) {
    const destination = process.argv[writeIndex + 1];
    if (!destination) throw new Error("--write-inventory requires a Markdown path.");
    writeFileSync(destination, markdownInventory(report));
  }
  const catalogIndex = process.argv.indexOf("--write-source-catalog");
  if (catalogIndex !== -1) {
    const destination = process.argv[catalogIndex + 1];
    if (!destination) throw new Error("--write-source-catalog requires a Markdown path.");
    writeFileSync(destination, markdownSourceCatalog(report));
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
