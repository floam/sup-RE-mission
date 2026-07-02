import { execFile } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

/*
 * Exports observed point event names from the public CMS API.
 *
 * Campaign enumeration starts from the claim.superfluid.org Next.js server
 * action used by the claim UI, then cross-checks the public POST
 * /points/balance-batch endpoint in chunks up to --max-campaign-id (default
 * 9999). Requests are parallelized over HTTP/2 and cached.
 */

type CampaignMetadata = {
	campaignId: number
	name: string
	slug: string
	totalEvents: number
	memberCount: number
	lastEventAt: string | null
	createdAt: string
}

type BackendCampaignDoc = { id: number }

type PointEvent = {
	id: number
	eventName: string
	account: string
	points: number
	uniqueId: string | null
	createdAt: string
}

type PointEventsResponse = {
	events: PointEvent[]
	pagination: {
		page: number
		limit: number
		totalDocs: number
		totalPages: number
		hasNextPage: boolean
		hasPrevPage: boolean
	}
}

type BalanceBatchResponse = {
	campaignIds: number[]
	warnings?: { campaignId: number; message: string }[]
}

type ClaimProgramApp = {
	appId: string
	name: string
	season?: string
	program?: { id: number }
}

type CampaignSummary = CampaignMetadata & {
	events: Map<string, EventSummary>
	enumerationMode: "full" | "first-and-final-page-sample"
	pagesFetched: number[]
	observedEvents: number
}

type EventSummary = {
	name: string
	count: number
	seenAs: Map<string, number>
}

type DiscoveryDetails = {
	source: string
	backendSchema: string
	backendCampaignIds: number[]
	claimRouteProgramIds: number[]
	balanceBatchCampaignIds: number[]
	explicitCampaignIds: number[] | null
	resolvedCampaignIds: number[]
	missingFromCms: number[]
	maxCampaignId: number
	cachePath: string
	cacheHits: number
	cacheWrites: number
	backendDiscoveryError?: string
	claimRouteError?: string
	claimRouteNote: string
	batchEndpointNote: string
	pointsSubgraphNote: string
}

type JsonCache = Record<string, unknown>

const DEFAULT_OUTPUT_PATH = path.resolve(process.cwd(), "../website/public/point-event-names.html")
const DEFAULT_CACHE_PATH = path.resolve(process.cwd(), ".cache/point-event-names.json")
const DEFAULT_BASE_URL = "https://cms.superfluid.pro"
const DEFAULT_CLAIM_URL = "https://claim.superfluid.org"
const CLAIM_PROGRAM_APPS_ACTION = "0050c3f0d604f9162ceb3faa2d83005031b4be6b5f"
const PAGE_SIZE = 100
const DEFAULT_MAX_CAMPAIGN_ID = 9999
const DEFAULT_CONCURRENCY = 96
const DEFAULT_FULL_PRE_SEASON_6_CAMPAIGN_IDS = [502]
const HASH_LIKE_SUFFIX_PATTERN = /-(?:0x)?[a-f0-9]{8,}$/i
const execFileAsync = promisify(execFile)

function coalesceEventName(eventName: string) {
	return eventName.replace(HASH_LIKE_SUFFIX_PATTERN, "-{hash}")
}

function escapeHtml(value: string | number | null) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;")
}

function getArgValue(name: string) {
	return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
}

function parseNumberArg(name: string, defaultValue: number) {
	const value = Number.parseInt(getArgValue(name) || "", 10)
	return Number.isInteger(value) && value > 0 ? value : defaultValue
}

function parseNumberListArg(name: string) {
	const value = getArgValue(name)
	if (!value) return null
	return value
		.split(",")
		.map((id) => Number.parseInt(id.trim(), 10))
		.filter((id) => Number.isInteger(id) && id > 0)
}

function parseOutputPath() {
	return path.resolve(getArgValue("out") || DEFAULT_OUTPUT_PATH)
}

function parseBaseUrl() {
	return (getArgValue("base-url") || DEFAULT_BASE_URL).replace(/\/+$/, "")
}

async function loadCache(cachePath: string): Promise<JsonCache> {
	try {
		return JSON.parse(await readFile(cachePath, "utf8")) as JsonCache
	} catch {
		return {}
	}
}

async function saveCache(cachePath: string, cache: JsonCache) {
	await mkdir(path.dirname(cachePath), { recursive: true })
	await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`)
}

async function mapConcurrent<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
	const results = new Array<R>(items.length)
	let nextIndex = 0
	await Promise.all(
		Array.from({ length: Math.min(concurrency, items.length) }, async () => {
			while (nextIndex < items.length) {
				const index = nextIndex++
				results[index] = await worker(items[index])
			}
		}),
	)
	return results
}

async function fetchJson<T>(url: string, cache: JsonCache, stats: { hits: number; writes: number }, cacheable = true) {
	if (cacheable && cache[url]) {
		stats.hits++
		return cache[url] as T
	}

	let lastError: unknown
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			const { stdout } = await execFileAsync(
				"curl",
				[
					"--fail-with-body",
					"--silent",
					"--show-error",
					"--compressed",
					"--http2",
					"--connect-timeout",
					"5",
					"--max-time",
					"20",
					"--header",
					"accept: application/json",
					"--header",
					"user-agent: superfluid-pro-event-name-exporter/1.0",
					url,
				],
				{ maxBuffer: 1024 * 1024 * 50 },
			)
			const json = JSON.parse(stdout) as T
			if (cacheable) {
				cache[url] = json
				stats.writes++
			}
			return json
		} catch (error) {
			lastError = error
			if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500))
		}
	}
	throw lastError
}

async function postJson<T>(url: string, body: unknown, cache: JsonCache, stats: { hits: number; writes: number }) {
	const cacheKey = `POST ${url} ${JSON.stringify(body)}`
	if (cache[cacheKey]) {
		stats.hits++
		return cache[cacheKey] as T
	}
	const { stdout } = await execFileAsync(
		"curl",
		[
			"--fail-with-body",
			"--silent",
			"--show-error",
			"--compressed",
			"--http2",
			"--connect-timeout",
			"3",
			"--max-time",
			"8",
			"--header",
			"accept: application/json",
			"--header",
			"content-type: application/json",
			"--header",
			"user-agent: superfluid-pro-event-name-exporter/1.0",
			"--data",
			JSON.stringify(body),
			url,
		],
		{ maxBuffer: 1024 * 1024 * 50 },
	)
	const json = JSON.parse(stdout) as T
	cache[cacheKey] = json
	stats.writes++
	return json
}

async function postText(
	url: string,
	body: string,
	headers: string[],
	cache: JsonCache,
	stats: { hits: number; writes: number },
) {
	const cacheKey = `POST_TEXT ${url} ${headers.join("|")} ${body}`
	if (cache[cacheKey]) {
		stats.hits++
		return cache[cacheKey] as string
	}
	const headerArgs = headers.flatMap((header) => ["--header", header])
	const { stdout } = await execFileAsync(
		"curl",
		[
			"--fail-with-body",
			"--silent",
			"--show-error",
			"--compressed",
			"--http2",
			"--connect-timeout",
			"5",
			"--max-time",
			"20",
			...headerArgs,
			"--data-raw",
			body,
			url,
		],
		{ maxBuffer: 1024 * 1024 * 50 },
	)
	cache[cacheKey] = stdout
	stats.writes++
	return stdout
}

function parseClaimProgramAppsFlightResponse(response: string) {
	const payloadLine = response.split("\n").find((line) => /^1:/.test(line.trim()))
	if (!payloadLine) throw new Error("Claim route response did not include a program app payload line")
	return JSON.parse(payloadLine.replace(/^1:/, "")) as ClaimProgramApp[]
}

async function fetchClaimRouteProgramApps(claimUrl: string, cache: JsonCache, stats: { hits: number; writes: number }) {
	const response = await postText(
		claimUrl,
		"[]",
		[
			`next-action: ${CLAIM_PROGRAM_APPS_ACTION}`,
			"content-type: text/plain;charset=UTF-8",
			"accept: text/x-component",
			"user-agent: superfluid-pro-event-name-exporter/1.0",
		],
		cache,
		stats,
	)
	return parseClaimProgramAppsFlightResponse(response)
}

async function fetchCampaign(
	baseUrl: string,
	campaignId: number,
	cache: JsonCache,
	stats: { hits: number; writes: number },
) {
	try {
		return await fetchJson<CampaignMetadata>(`${baseUrl}/points/campaign?campaignId=${campaignId}`, cache, stats)
	} catch {
		return null
	}
}

async function discoverCampaignIdsFromCmsBackend() {
	if (!process.env.DATABASE_URI || !process.env.PAYLOAD_SECRET) return []
	const { getPayloadInstance } = await import("@/payload")
	const payload = await getPayloadInstance()
	const campaignIds: number[] = []
	let page = 1

	while (true) {
		const result = await payload.find({
			collection: "campaigns",
			depth: 0,
			limit: 500,
			overrideAccess: true,
			page,
			sort: "id",
		})
		campaignIds.push(...(result.docs as BackendCampaignDoc[]).map((campaign) => campaign.id))
		if (!result.hasNextPage) break
		page++
	}

	return campaignIds
}

async function discoverExistingCampaignIdsWithBalanceBatch(
	baseUrl: string,
	maxCampaignId: number,
	cache: JsonCache,
	stats: { hits: number; writes: number },
	concurrency: number,
) {
	const allIds = Array.from({ length: maxCampaignId }, (_, index) => index + 1)
	const chunks = Array.from({ length: Math.ceil(allIds.length / 50) }, (_, index) =>
		allIds.slice(index * 50, index * 50 + 50),
	)
	const responses = await mapConcurrent(chunks, concurrency, (campaignIds) =>
		postJson<BalanceBatchResponse>(
			`${baseUrl}/points/balance-batch`,
			{
				account: "0x0000000000000000000000000000000000000000",
				campaignIds,
			},
			cache,
			stats,
		),
	)
	const missingIds = new Set(
		responses.flatMap((response) => response.warnings?.map((warning) => warning.campaignId) || []),
	)
	return allIds.filter((id) => !missingIds.has(id))
}

async function discoverClaimRouteProgramIds(cache: JsonCache, stats: { hits: number; writes: number }) {
	const claimUrl = (getArgValue("claim-url") || DEFAULT_CLAIM_URL).replace(/\/+$/, "")
	const programApps = await fetchClaimRouteProgramApps(claimUrl, cache, stats)
	return uniqSorted(
		programApps
			.map((app) => app.program?.id)
			.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0),
	)
}

function uniqSorted(ids: number[]) {
	return Array.from(new Set(ids)).sort((a, b) => a - b)
}

async function discoverCampaigns(baseUrl: string, cache: JsonCache, stats: { hits: number; writes: number }) {
	const explicitCampaignIds = parseNumberListArg("campaign-ids")
	const maxCampaignId = parseNumberArg("max-campaign-id", DEFAULT_MAX_CAMPAIGN_ID)
	const concurrency = parseNumberArg("concurrency", DEFAULT_CONCURRENCY)
	let backendCampaignIds: number[] = []
	let claimRouteProgramIds: number[] = []
	let balanceBatchCampaignIds: number[] = []
	let backendDiscoveryError: string | undefined
	let claimRouteError: string | undefined

	try {
		backendCampaignIds = await discoverCampaignIdsFromCmsBackend()
	} catch (error) {
		backendDiscoveryError = error instanceof Error ? error.message : String(error)
	}

	try {
		claimRouteProgramIds = await discoverClaimRouteProgramIds(cache, stats)
	} catch (error) {
		claimRouteError = error instanceof Error ? error.message : String(error)
	}

	balanceBatchCampaignIds = await discoverExistingCampaignIdsWithBalanceBatch(
		baseUrl,
		maxCampaignId,
		cache,
		stats,
		concurrency,
	)
	const ids = explicitCampaignIds || uniqSorted([...claimRouteProgramIds, ...balanceBatchCampaignIds])
	const campaigns = await mapConcurrent(ids, concurrency, (campaignId) =>
		fetchCampaign(baseUrl, campaignId, cache, stats),
	)
	const resolvedCampaigns = campaigns
		.filter((campaign): campaign is CampaignMetadata => !!campaign)
		.sort((a, b) => a.campaignId - b.campaignId)
	const resolvedCampaignIds = resolvedCampaigns.map((campaign) => campaign.campaignId)
	const missingFromCms = ids.filter((id) => !resolvedCampaignIds.includes(id))

	return {
		campaigns: resolvedCampaigns,
		discoveryDetails: {
			source: explicitCampaignIds
				? "explicit-campaign-ids-with-claim-route-and-public-cms-cross-check"
				: `claim-route-plus-parallel-post-balance-batch-discovery-1-to-${maxCampaignId}`,
			backendSchema: 'Payload collection "campaigns" / table "campaigns" / id numeric',
			backendCampaignIds,
			claimRouteProgramIds,
			balanceBatchCampaignIds,
			explicitCampaignIds,
			resolvedCampaignIds,
			missingFromCms,
			maxCampaignId,
			cachePath: path.resolve(getArgValue("cache") || DEFAULT_CACHE_PATH),
			cacheHits: stats.hits,
			cacheWrites: stats.writes,
			backendDiscoveryError,
			claimRouteError,
			claimRouteNote:
				"Uses the same Next.js server action as claim.superfluid.org getProgramApps to list onchain program IDs, then cross-checks those IDs against the offchain CMS /points/campaign endpoint.",
			batchEndpointNote:
				"Checked the backend API registry: POST batch endpoints exist for balances/signatures, but there is no public POST campaign-metadata batch endpoint, so hidden campaign discovery also uses /points/balance-batch in chunks of 50 to find existing offchain CMS IDs through the configured maximum.",
			pointsSubgraphNote:
				"No separate point-event subgraph endpoint was found in this repo/config; event names are sampled or fetched from the offchain CMS /points/events endpoint.",
		} satisfies DiscoveryDetails,
	}
}

function getSeasonNumber(campaign: CampaignMetadata) {
	const match = campaign.name.match(/\bS(\d+)\b/i) || campaign.slug.match(/(?:^|-)s(\d+)(?:-|$)/i)
	return match ? Number.parseInt(match[1], 10) : null
}

function isPreSeason6FinishedCampaign(campaign: CampaignMetadata, fullPreSeason6CampaignIds: number[]) {
	const season = getSeasonNumber(campaign)
	return season !== null && season < 6 && !fullPreSeason6CampaignIds.includes(campaign.campaignId)
}

async function fetchCampaignEvents(
	baseUrl: string,
	campaign: CampaignMetadata,
	cache: JsonCache,
	stats: { hits: number; writes: number },
	fullPreSeason6CampaignIds: number[],
) {
	const firstPage = await fetchJson<PointEventsResponse>(
		`${baseUrl}/points/events?campaignId=${campaign.campaignId}&limit=${PAGE_SIZE}&page=1`,
		cache,
		stats,
	)
	const totalPages = firstPage.pagination.totalPages || 1
	const sampleOnly = isPreSeason6FinishedCampaign(campaign, fullPreSeason6CampaignIds)
	const pages = sampleOnly
		? [1, totalPages].filter((page, index, all) => all.indexOf(page) === index)
		: Array.from({ length: totalPages }, (_, index) => index + 1)
	const remainingPages = pages.filter((page) => page !== 1)
	const remainingResponses = await mapConcurrent(
		remainingPages,
		parseNumberArg("concurrency", DEFAULT_CONCURRENCY),
		(page) =>
			fetchJson<PointEventsResponse>(
				`${baseUrl}/points/events?campaignId=${campaign.campaignId}&limit=${PAGE_SIZE}&page=${page}`,
				cache,
				stats,
			),
	)

	return {
		events: [firstPage, ...remainingResponses].flatMap((response) => response.events),
		mode: sampleOnly ? "first-and-final-page-sample" : "full",
		pagesFetched: pages,
	} as const
}

async function exportPointEventNames(outputPath = parseOutputPath()) {
	const baseUrl = parseBaseUrl()
	const cachePath = path.resolve(getArgValue("cache") || DEFAULT_CACHE_PATH)
	const cache = await loadCache(cachePath)
	const stats = { hits: 0, writes: 0 }
	const fullPreSeason6CampaignIds =
		parseNumberListArg("full-pre-season-6-campaign-ids") || DEFAULT_FULL_PRE_SEASON_6_CAMPAIGN_IDS
	const { campaigns, discoveryDetails } = await discoverCampaigns(baseUrl, cache, stats)
	const summaries: CampaignSummary[] = []

	console.log(`Discovered ${campaigns.length} campaigns from ${baseUrl}.`)
	console.log(`Campaign enumeration source: ${discoveryDetails.source}.`)
	if (discoveryDetails.backendDiscoveryError)
		console.warn(`CMS backend campaign discovery failed: ${discoveryDetails.backendDiscoveryError}`)

	await mapConcurrent(campaigns, parseNumberArg("campaign-concurrency", 8), async (campaign) => {
		console.log(`Scanning campaign ${campaign.campaignId} (${campaign.name})...`)
		const { events, mode, pagesFetched } = await fetchCampaignEvents(
			baseUrl,
			campaign,
			cache,
			stats,
			fullPreSeason6CampaignIds,
		)
		const summary: CampaignSummary = {
			...campaign,
			events: new Map<string, EventSummary>(),
			enumerationMode: mode,
			pagesFetched,
			observedEvents: events.length,
		}

		for (const event of events) {
			const coalescedName = coalesceEventName(event.eventName)
			const eventSummary = summary.events.get(coalescedName) || {
				name: coalescedName,
				count: 0,
				seenAs: new Map<string, number>(),
			}
			eventSummary.count++
			eventSummary.seenAs.set(event.eventName, (eventSummary.seenAs.get(event.eventName) || 0) + 1)
			summary.events.set(coalescedName, eventSummary)
		}
		summaries.push(summary)
	})
	summaries.sort((a, b) => a.campaignId - b.campaignId)

	await saveCache(cachePath, cache)
	discoveryDetails.cacheHits = stats.hits
	discoveryDetails.cacheWrites = stats.writes

	const generatedAt = new Date().toISOString()
	const totalEvents = summaries.reduce((sum, campaign) => sum + campaign.observedEvents, 0)
	const totalNames = summaries.reduce((sum, campaign) => sum + campaign.events.size, 0)
	const discoveryHtml = `<section><h2>Campaign enumeration</h2><table><tbody><tr><th>Source used</th><td>${escapeHtml(discoveryDetails.source)}</td></tr><tr><th>Backend schema</th><td><code>${escapeHtml(discoveryDetails.backendSchema)}</code>${discoveryDetails.backendDiscoveryError ? `<br><span class="muted">Backend discovery failed: ${escapeHtml(discoveryDetails.backendDiscoveryError)}</span>` : ""}</td></tr><tr><th>Claim app route</th><td>${escapeHtml(discoveryDetails.claimRouteNote)}${discoveryDetails.claimRouteError ? `<br><span class="muted">Claim route failed: ${escapeHtml(discoveryDetails.claimRouteError)}</span>` : ""}</td></tr><tr><th>Public CMS scan range</th><td><code>1..${discoveryDetails.maxCampaignId}</code></td></tr><tr><th>Cache</th><td><code>${escapeHtml(discoveryDetails.cachePath)}</code> · ${discoveryDetails.cacheHits} hits · ${discoveryDetails.cacheWrites} writes</td></tr><tr><th>Backend campaign IDs</th><td>${discoveryDetails.backendCampaignIds.length ? discoveryDetails.backendCampaignIds.map((id) => `<code>${id}</code>`).join(", ") : '<span class="muted">None available in this run.</span>'}</td></tr><tr><th>Claim route program IDs</th><td>${discoveryDetails.claimRouteProgramIds.length ? discoveryDetails.claimRouteProgramIds.map((id) => `<code>${id}</code>`).join(", ") : '<span class="muted">None available in this run.</span>'}</td></tr><tr><th>Balance-batch campaign IDs</th><td>${discoveryDetails.balanceBatchCampaignIds.length ? discoveryDetails.balanceBatchCampaignIds.map((id) => `<code>${id}</code>`).join(", ") : '<span class="muted">None available in this run.</span>'}</td></tr><tr><th>Explicit campaign IDs</th><td>${discoveryDetails.explicitCampaignIds?.length ? discoveryDetails.explicitCampaignIds.map((id) => `<code>${id}</code>`).join(", ") : '<span class="muted">Not used.</span>'}</td></tr><tr><th>Resolved offchain CMS IDs</th><td>${discoveryDetails.resolvedCampaignIds.map((id) => `<code>${id}</code>`).join(", ")}</td></tr><tr><th>Missing from offchain CMS</th><td>${discoveryDetails.missingFromCms.length ? discoveryDetails.missingFromCms.map((id) => `<code>${id}</code>`).join(", ") : '<span class="muted">None.</span>'}</td></tr><tr><th>POST batch endpoint check</th><td>${escapeHtml(discoveryDetails.batchEndpointNote)}</td></tr><tr><th>Point-event subgraph cross-check</th><td>${escapeHtml(discoveryDetails.pointsSubgraphNote)}</td></tr></tbody></table></section>`

	const campaignSections = summaries
		.map((campaign) => {
			const eventRows = Array.from(campaign.events.values())
				.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
				.map((event) => {
					const variants = Array.from(event.seenAs.entries())
						.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
						.map(([name, count]) => `<li><code>${escapeHtml(name)}</code> <span class="muted">× ${count}</span></li>`)
						.join("")
					return `<tr><td><code>${escapeHtml(event.name)}</code></td><td>${event.count}</td><td><ul>${variants}</ul></td></tr>`
				})
				.join("")
			return `<section><h2>${campaign.campaignId}: ${escapeHtml(campaign.name)}</h2><p><code>${escapeHtml(campaign.slug)}</code> · ${campaign.events.size} coalesced event names across ${campaign.observedEvents} observed/${campaign.totalEvents} total point events. Mode: <code>${campaign.enumerationMode}</code>; pages fetched: <code>${campaign.pagesFetched.join(",")}</code>. Last event: ${escapeHtml(campaign.lastEventAt)}</p><table><thead><tr><th>Coalesced event name</th><th>Observed events</th><th>Seen as</th></tr></thead><tbody>${eventRows || '<tr><td colspan="3" class="muted">No point events found.</td></tr>'}</tbody></table></section>`
		})
		.join("\n")

	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Point event names by campaign</title><style>body{font-family:Inter,Arial,sans-serif;line-height:1.5;margin:2rem;color:#101828;background:#fff}main{max-width:1100px;margin:auto}h1{margin-bottom:.25rem}section{margin-top:2.5rem}table{width:100%;border-collapse:collapse;margin-top:1rem}th,td{border:1px solid #d0d5dd;padding:.65rem;text-align:left;vertical-align:top}th{background:#f2f4f7}code{background:#f9fafb;border:1px solid #eaecf0;border-radius:4px;padding:.1rem .25rem}.muted{color:#667085;font-weight:400}ul{margin:0;padding-left:1.25rem}</style></head><body><main><h1>Point event names by campaign</h1><p class="muted">Generated ${escapeHtml(generatedAt)} from <code>${escapeHtml(baseUrl)}</code>. Campaigns are discovered from the claim app's <code>getProgramApps</code> Next.js route and cross-checked by parallel cached POSTs to <code>/points/balance-batch</code> in chunks of 50 through <code>${discoveryDetails.maxCampaignId}</code>. Season 6+ campaigns and configured in-progress pre-season-6 campaigns (<code>${fullPreSeason6CampaignIds.join(",")}</code>) fetch all event pages; finished pre-season-6 campaigns fetch only the first 100 and final 100 events. Hash-like trailing suffixes matching <code>-(?:0x)?[a-f0-9]{8,}</code> are coalesced to <code>-{hash}</code>.</p><p>${summaries.length} campaigns, ${totalNames} coalesced event names, ${totalEvents} observed point events.</p>${discoveryHtml}${campaignSections}</main></body></html>\n`

	await mkdir(path.dirname(outputPath), { recursive: true })
	await writeFile(outputPath, html)
	console.log(
		`Exported ${summaries.length} campaigns, ${totalNames} coalesced event names, ${totalEvents} observed point events.`,
	)
	console.log(`Wrote ${outputPath}`)
	console.log(`Cache ${cachePath}: ${stats.hits} hits, ${stats.writes} writes.`)
	return { campaigns: summaries.length, totalNames, totalEvents, outputPath }
}

if (import.meta.url === `file://${process.argv[1]}`) {
	exportPointEventNames().catch((error) => {
		console.error(error)
		process.exit(1)
	})
}

export { coalesceEventName, exportPointEventNames }
