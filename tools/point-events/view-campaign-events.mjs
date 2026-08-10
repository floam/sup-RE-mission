import { createServer } from "node:http";

const CMS_BASE_URL = (process.env.CMS_BASE_URL || "https://cms.superfluid.pro").replace(/\/+$/, "");
const HOST = process.env.HOST || "127.0.0.1";
const parsedPort = Number.parseInt(process.env.PORT || "4173", 10);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 4173;
const PAGE_SIZE = 100;
const MAX_PAGES_PER_ACTION = 3;
const MAX_EVENTS_PER_ACTION = PAGE_SIZE * MAX_PAGES_PER_ACTION;

function parsePositiveInteger(value, name) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== String(value).trim()) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

async function fetchEventPage(campaignId, page) {
  const url = new URL("/points/events", CMS_BASE_URL);
  url.searchParams.set("campaignId", String(campaignId));
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("page", String(page));

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "sup-remission-campaign-event-view/1.0",
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`CMS ${response.status}: ${body.slice(0, 500)}`);
  }
  const parsed = JSON.parse(body);
  if (!Array.isArray(parsed.events) || !parsed.pagination) {
    throw new Error("CMS returned an unexpected point-events response");
  }
  return parsed;
}

async function loadEventBatch(campaignId, startPage) {
  const events = [];
  const pagesFetched = [];
  let page = startPage;
  let nextPage = null;

  for (let index = 0; index < MAX_PAGES_PER_ACTION; index += 1) {
    const result = await fetchEventPage(campaignId, page);
    events.push(...result.events);
    pagesFetched.push(result.pagination.page);

    if (!result.pagination.hasNextPage) {
      nextPage = null;
      break;
    }

    page = result.pagination.page + 1;
    nextPage = page;
  }

  return {
    campaignId,
    startPage,
    pageSize: PAGE_SIZE,
    maxEventsPerAction: MAX_EVENTS_PER_ACTION,
    pagesFetched,
    events,
    nextPage,
  };
}

const INDEX_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Superfluid campaign events</title>
<style>
:root { color-scheme: light dark; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
body { margin: 0; padding: 1.25rem; }
main { max-width: 1200px; margin: 0 auto; }
form, .controls { display: flex; gap: .65rem; align-items: center; flex-wrap: wrap; }
input, button { font: inherit; padding: .55rem .7rem; }
button { cursor: pointer; }
button:disabled { cursor: default; opacity: .55; }
#status { min-height: 1.4rem; margin: .9rem 0; }
.table-wrap { overflow-x: auto; border: 1px solid color-mix(in srgb, CanvasText 22%, Canvas); }
table { border-collapse: collapse; width: 100%; min-width: 920px; }
th, td { border-bottom: 1px solid color-mix(in srgb, CanvasText 16%, Canvas); padding: .45rem .55rem; text-align: left; vertical-align: top; }
th { position: sticky; top: 0; background: Canvas; }
td.points { text-align: right; font-variant-numeric: tabular-nums; }
td.account, td.unique { overflow-wrap: anywhere; }
.muted { opacity: .7; }
.error { color: #d33; }
</style>
</head>
<body>
<main>
<h1>Campaign point events</h1>
<p class="muted">On demand only. Each action fetches at most 300 events from CMS, in newest-first page order.</p>
<form id="campaign-form">
<label>Campaign ID <input id="campaign-id" inputmode="numeric" pattern="[0-9]+" required></label>
<button id="load-button" type="submit">Load newest events</button>
</form>
<p id="status" class="muted"></p>
<div class="controls">
<button id="more-button" type="button" hidden>Load 300 more</button>
<span id="summary" class="muted"></span>
</div>
<div class="table-wrap">
<table>
<thead><tr><th>createdAt</th><th>points</th><th>eventName</th><th>account</th><th>uniqueId</th></tr></thead>
<tbody id="events-body"></tbody>
</table>
</div>
</main>
<script>
const form = document.querySelector("#campaign-form");
const campaignInput = document.querySelector("#campaign-id");
const loadButton = document.querySelector("#load-button");
const moreButton = document.querySelector("#more-button");
const status = document.querySelector("#status");
const summary = document.querySelector("#summary");
const tbody = document.querySelector("#events-body");
let campaignId = null;
let nextPage = null;
let loadedEvents = 0;

const initialCampaignId = new URLSearchParams(location.search).get("campaignId");
if (initialCampaignId && /^\\d+$/.test(initialCampaignId)) campaignInput.value = initialCampaignId;

function setBusy(busy) {
  loadButton.disabled = busy;
  moreButton.disabled = busy;
}

function appendCell(row, value, className) {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = value == null ? "" : String(value);
  row.append(cell);
}

function appendEvents(events) {
  for (const event of events) {
    const row = document.createElement("tr");
    appendCell(row, event.createdAt);
    appendCell(row, event.points, "points");
    appendCell(row, event.eventName);
    appendCell(row, event.account, "account");
    appendCell(row, event.uniqueId, "unique");
    tbody.append(row);
  }
}

async function loadBatch(page, replace) {
  setBusy(true);
  status.className = "muted";
  status.textContent = "Loading campaign " + campaignId + ", starting at page " + page + "…";
  try {
    const response = await fetch("/api/events?campaignId=" + encodeURIComponent(campaignId) + "&page=" + page, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "HTTP " + response.status);
    if (replace) {
      tbody.replaceChildren();
      loadedEvents = 0;
    }
    appendEvents(payload.events);
    loadedEvents += payload.events.length;
    nextPage = payload.nextPage;
    moreButton.hidden = nextPage == null;
    status.textContent = "Fetched " + payload.events.length + " event" + (payload.events.length === 1 ? "" : "s") + " from page" + (payload.pagesFetched.length === 1 ? "" : "s") + " " + payload.pagesFetched.join(", ") + ".";
    summary.textContent = loadedEvents + " loaded" + (nextPage == null ? " · end of available pages" : " · next page " + nextPage);
  } catch (error) {
    status.className = "error";
    status.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    setBusy(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = campaignInput.value.trim();
  if (!/^\\d+$/.test(value) || Number(value) <= 0) {
    status.className = "error";
    status.textContent = "Campaign ID must be a positive integer.";
    return;
  }
  campaignId = value;
  nextPage = 1;
  history.replaceState(null, "", "?campaignId=" + encodeURIComponent(value));
  void loadBatch(1, true);
});

moreButton.addEventListener("click", () => {
  if (campaignId && nextPage != null) void loadBatch(nextPage, false);
});
</script>
</body>
</html>`;

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(`${JSON.stringify(value)}\n`);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || `${HOST}:${PORT}`}`);
    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      });
      response.end(INDEX_HTML);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/events") {
      const campaignId = parsePositiveInteger(url.searchParams.get("campaignId"), "campaignId");
      const page = parsePositiveInteger(url.searchParams.get("page") || "1", "page");
      sendJson(response, 200, await loadEventBatch(campaignId, page));
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Campaign event view: http://${HOST}:${PORT}`);
  console.log(`CMS source: ${CMS_BASE_URL}`);
  console.log(`Each action fetches at most ${MAX_EVENTS_PER_ACTION} newest-first events.`);
});
