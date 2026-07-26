import { execFile } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { createPublicClient, getAddress, http } from "viem"
import { base } from "viem/chains"

/*
 * Exports observed point event names from the public CMS API.
 *
 * Campaign enumeration starts from the onchain SUP Goldsky subgraph
 * Program entities. Direct Base RPC verifies each program's pool via
 * getProgramPool(programId) and reads current pool getTotalFlowRate. The Base
 * protocol subgraph bulk-enriches indexed pool state, members, units, and
 * distributions. claim.superfluid.org/api/programs adds app, name, and season
 * attribution; CMS /points/* adds offchain campaign and event metadata. Public
 * /points/balance-batch is scanned for CMS-only/offchain campaign IDs.
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
	category?: string
	season?: string
	program?: {
		id: number
		onchainInfo?: {
			poolAddress?: string
			fundingFlowRate?: string | number | bigint
			subsidyFlowRate?: string | number | bigint
			fundingStartDate?: string | number | bigint
			fundingEndDate?: string | number | bigint
			programDuration?: string | number | bigint
			totalAllocated?: string | number | bigint
			totalClaimed?: string | number | bigint
			totalClaimedTimestamp?: number
			isFundingStarted?: boolean
			isFundingFinished?: boolean
			totalMembers?: number
		}
	}
}

type ClaimProgramsApiResponse = {
	json: ClaimProgramApp[]
}

type SupProgram = {
	id: string
	distributionPool: string
	fundingAmount: string
	subsidyAmount: string
	earlyEndDate: string
	endDate: string
	stoppedDate: string
	cancellationDate: string
	returnedDeposit: string
	blockTimestamp: string
	transactionHash: string
}

type SupProgramsGraphqlResponse = {
	data?: {
		programs: SupProgram[]
		_meta?: { block?: { number?: number; timestamp?: number } }
	}
	errors?: unknown[]
}

type ProtocolPool = {
	id: string
	flowRate: string
	totalMembers: number
	totalUnits: string
	totalAmountDistributedUntilUpdatedAt: string
	updatedAtTimestamp: string
}

type ProtocolPoolsGraphqlResponse = {
	data?: {
		pools: ProtocolPool[]
		_meta?: { block?: { number?: number; timestamp?: number } }
	}
	errors?: unknown[]
}

type RpcProgramPool = {
	programId: number
	poolAddress: string
	totalFlowRate: string | null
	error?: string
}

type CampaignDiscoveryRecord = {
	id: number
	claimApps: ClaimProgramApp[]
	cmsExists: boolean
	supProgram?: SupProgram
	rpcPool?: RpcProgramPool
	protocolPool?: ProtocolPool
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
	claimApiProgramIds: number[]
	supSubgraphProgramIds: number[]
	balanceBatchCampaignIds: number[]
	allDiscoveredIds: number[]
	explicitCampaignIds: number[] | null
	resolvedCampaignIds: number[]
	missingFromCms: number[]
	onchainOnlyIds: number[]
	cmsOnlyIds: number[]
	maxCampaignId: number
	cachePath: string
	cacheHits: number
	cacheWrites: number
	backendDiscoveryError?: string
	claimRouteError?: string
	claimApiError?: string
	supSubgraphError?: string
	protocolSubgraphError?: string
	rpcError?: string
	claimRouteNote: string
	claimApiNote: string
	supSubgraphNote: string
	rpcNote: string
	protocolSubgraphNote: string
	batchEndpointNote: string
	pointsSubgraphNote: string
	records: CampaignDiscoveryRecord[]
}

type JsonCache = Record<string, unknown>

const DEFAULT_OUTPUT_PATH = path.resolve(process.cwd(), "tools/point-events/point-event-names.html")
const DEFAULT_CACHE_PATH = path.resolve(process.cwd(), ".cache/point-event-names.json")
const DEFAULT_BASE_URL = "https://cms.superfluid.pro"
const DEFAULT_CLAIM_URL = "https://claim.superfluid.org"
const DEFAULT_SUP_SUBGRAPH_URL =
	"https://api.goldsky.com/api/public/project_clsnd6xsoma5j012qepvucfpp/subgraphs/sup/v2/gn"
const DEFAULT_PROTOCOL_SUBGRAPH_URL = "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1"
const DEFAULT_BASE_RPC_URL = "https://rpc-endpoints.superfluid.dev/base-mainnet"
const FLUID_EP_PROGRAM_MANAGER = "0x1e32cf099992E9D3b17eDdDFFfeb2D07AED95C6a" as const
const CLAIM_PROGRAM_APPS_ACTION = "0050c3f0d604f9162ceb3faa2d83005031b4be6b5f"
const PAGE_SIZE = 100
const DEFAULT_MAX_CAMPAIGN_ID = 9999
const DEFAULT_CONCURRENCY = 96
const DEFAULT_FULL_PRE_SEASON_6_CAMPAIGN_IDS = [502]
const HASH_LIKE_SUFFIX_PATTERN = /-(?:0x)?[a-f0-9]{8,}$/i
const execFileAsync = promisify(execFile)

const programManagerAbi = [
	{
		type: "function",
		name: "getProgramPool",
		stateMutability: "view",
		inputs: [{ name: "programId", type: "uint256" }],
		outputs: [{ name: "pool", type: "address" }],
	},
] as const

const poolAbi = [
	{
		type: "function",
		name: "getTotalFlowRate",
		stateMutability: "view",
		inputs: [],
		outputs: [{ name: "totalFlowRate", type: "int96" }],
	},
] as const

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

async function fetchClaimApiProgramApps(claimUrl: string, cache: JsonCache, stats: { hits: number; writes: number }) {
	const response = await fetchJson<ClaimProgramsApiResponse>(`${claimUrl}/api/programs`, cache, stats)
	return response.json
}

function parseBigIntish(value: string | number | bigint | undefined) {
	if (value === undefined) return 0n
	if (typeof value === "bigint") return value
	if (typeof value === "number") return BigInt(Math.trunc(value))
	const sanitized = value.startsWith("$n") ? value.slice(2) : value
	return BigInt(sanitized || "0")
}

function parseTimestampSeconds(value: string | number | bigint | undefined) {
	const parsed = parseBigIntish(value)
	return parsed > 0n && parsed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(parsed) : null
}

function formatDateFromSeconds(value: string | number | bigint | undefined) {
	const timestamp = parseTimestampSeconds(value)
	return timestamp ? new Date(timestamp * 1000).toISOString().slice(0, 10) : ""
}

function formatSupPerMonth(flowRate: string | number | bigint | undefined) {
	const rate = parseBigIntish(flowRate)
	if (rate === 0n) return "0"
	const monthlyWei = rate * 2_592_000n
	const wholeSup = monthlyWei / 1_000_000_000_000_000_000n
	return `${wholeSup.toLocaleString("en-US")}/mo`
}

function renderIdList(ids: number[]) {
	return ids.length ? ids.map((id) => `<code>${id}</code>`).join(", ") : '<span class="muted">None.</span>'
}

function renderCampaignDiscoveryRows(records: CampaignDiscoveryRecord[]) {
	return records
		.map((record) => {
			const seasons = Array.from(new Set(record.claimApps.map((app) => app.season).filter(Boolean))).sort()
			const seasonLabel = seasons.length
				? `S${seasons.join("/")}`
				: record.supProgram
					? record.cmsExists
						? "CMS+onchain"
						: "onchain-only"
					: record.cmsExists
						? "CMS-only"
						: "unknown"
			const apps = record.claimApps
				.map((app) => `<code>${escapeHtml(app.appId)}</code> (${escapeHtml(app.name)})`)
				.join("<br>")
			const pool = record.protocolPool
			const supProgram = record.supProgram
			const rpcPool = record.rpcPool
			const rpcVerified = supProgram && rpcPool?.poolAddress
				? supProgram.distributionPool.toLowerCase() === rpcPool.poolAddress.toLowerCase()
					? "yes"
					: "mismatch"
				: rpcPool?.error
					? "error"
					: "—"
			return `<tr><td><code>${record.id}</code></td><td>${escapeHtml(seasonLabel)}</td><td>${apps || '<span class="muted">—</span>'}</td><td>${record.cmsExists ? "yes" : "no"}</td><td>${supProgram ? "yes" : "no"}</td><td>${escapeHtml(rpcVerified)}</td><td>${rpcPool?.totalFlowRate !== null && rpcPool?.totalFlowRate !== undefined ? escapeHtml(formatSupPerMonth(rpcPool.totalFlowRate)) : '<span class="muted">—</span>'}</td><td>${pool ? escapeHtml(formatSupPerMonth(pool.flowRate)) : '<span class="muted">—</span>'}</td><td>${escapeHtml(formatDateFromSeconds(supProgram?.endDate))}</td><td>${escapeHtml(formatDateFromSeconds(supProgram?.stoppedDate))}</td><td>${pool ? escapeHtml(pool.totalMembers) : '<span class="muted">—</span>'}</td></tr>`
		})
		.join("")
}

async function fetchSupSubgraphPrograms(cache: JsonCache, stats: { hits: number; writes: number }) {
	const supSubgraphUrl = getArgValue("sup-subgraph-url") || DEFAULT_SUP_SUBGRAPH_URL
	const programs: SupProgram[] = []
	let lastId = ""

	while (true) {
		const response = await postJson<SupProgramsGraphqlResponse>(
			supSubgraphUrl,
			{
				query: `query SupPrograms($lastId: ID!) {
					programs(first: 1000, orderBy: id, orderDirection: asc, where: { id_gt: $lastId }) {
						id
						distributionPool
						fundingAmount
						subsidyAmount
						earlyEndDate
						endDate
						stoppedDate
						cancellationDate
						returnedDeposit
						blockTimestamp
						transactionHash
					}
					_meta { block { number timestamp } }
				}`,
				variables: { lastId },
			},
			cache,
			stats,
		)
		if (response.errors?.length) throw new Error(`SUP subgraph returned errors: ${JSON.stringify(response.errors)}`)
		const page = response.data?.programs || []
		if (page.length === 0) break
		programs.push(...page)
		lastId = page.at(-1)?.id || lastId
	}

	return programs
}

async function fetchProtocolPools(
	poolAddresses: string[],
	cache: JsonCache,
	stats: { hits: number; writes: number },
	concurrency: number,
) {
	const protocolSubgraphUrl = getArgValue("protocol-subgraph-url") || DEFAULT_PROTOCOL_SUBGRAPH_URL
	const uniquePools = Array.from(new Set(poolAddresses.map((pool) => pool.toLowerCase()).filter(Boolean))).sort()
	const chunks = Array.from({ length: Math.ceil(uniquePools.length / 100) }, (_, index) =>
		uniquePools.slice(index * 100, index * 100 + 100),
	)
	const responses = await mapConcurrent(chunks, concurrency, (pools) =>
		postJson<ProtocolPoolsGraphqlResponse>(
			protocolSubgraphUrl,
			{
				query: `query ProtocolPools($pools: [ID!]!) {
					pools(first: 1000, where: { id_in: $pools }) {
						id
						flowRate
						totalMembers
						totalUnits
						totalAmountDistributedUntilUpdatedAt
						updatedAtTimestamp
					}
					_meta { block { number timestamp } }
				}`,
				variables: { pools },
			},
			cache,
			stats,
		),
	)
	const pools = responses.flatMap((response) => {
		if (response.errors?.length)
			throw new Error(`Protocol subgraph returned errors: ${JSON.stringify(response.errors)}`)
		return response.data?.pools || []
	})
	return new Map(pools.map((pool) => [pool.id.toLowerCase(), pool]))
}

async function fetchRpcProgramPools(programIds: number[], concurrency: number) {
	const rpcUrl = getArgValue("rpc-url") || process.env.BASE_RPC_URL || process.env.RPC_URL || DEFAULT_BASE_RPC_URL
	const client = createPublicClient({ chain: base, transport: http(rpcUrl) })
	const entries = await mapConcurrent(programIds, Math.min(concurrency, 16), async (programId) => {
		try {
			const poolAddress = await client.readContract({
				address: FLUID_EP_PROGRAM_MANAGER,
				abi: programManagerAbi,
				functionName: "getProgramPool",
				args: [BigInt(programId)],
			})
			const totalFlowRate = await client.readContract({
				address: poolAddress,
				abi: poolAbi,
				functionName: "getTotalFlowRate",
			})
			return [
				programId,
				{ programId, poolAddress: getAddress(poolAddress), totalFlowRate: totalFlowRate.toString() },
			] as const
		} catch (error) {
			return [
				programId,
				{
					programId,
					poolAddress: "",
					totalFlowRate: null,
					error: error instanceof Error ? error.message : String(error),
				},
			] as const
		}
	})
	return new Map<number, RpcProgramPool>(entries)
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

async function discoverClaimApiProgramApps(cache: JsonCache, stats: { hits: number; writes: number }) {
	const claimUrl = (getArgValue("claim-url") || DEFAULT_CLAIM_URL).replace(/\/+$/, "")
	return fetchClaimApiProgramApps(claimUrl, cache, stats)
}

function uniqSorted(ids: number[]) {
	return Array.from(new Set(ids)).sort((a, b) => a - b)
}

function getClaimProgramId(app: ClaimProgramApp) {
	const id = app.program?.id
	return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null
}

function mapClaimAppsByProgramId(apps: ClaimProgramApp[]) {
	const appsByProgramId = new Map<number, ClaimProgramApp[]>()
	for (const app of apps) {
		const id = getClaimProgramId(app)
		if (!id) continue
		const appsForProgram = appsByProgramId.get(id) || []
		appsForProgram.push(app)
		appsByProgramId.set(id, appsForProgram)
	}
	return appsByProgramId
}

async function discoverCampaigns(baseUrl: string, cache: JsonCache, stats: { hits: number; writes: number }) {
	const explicitCampaignIds = parseNumberListArg("campaign-ids")
	const maxCampaignId = parseNumberArg("max-campaign-id", DEFAULT_MAX_CAMPAIGN_ID)
	const concurrency = parseNumberArg("concurrency", DEFAULT_CONCURRENCY)
	let backendCampaignIds: number[] = []
	let claimRouteProgramIds: number[] = []
	let claimApiProgramApps: ClaimProgramApp[] = []
	let claimApiProgramIds: number[] = []
	let supSubgraphPrograms: SupProgram[] = []
	let supSubgraphProgramIds: number[] = []
	let protocolPools = new Map<string, ProtocolPool>()
	let rpcProgramPools = new Map<number, RpcProgramPool>()
	let balanceBatchCampaignIds: number[] = []
	let backendDiscoveryError: string | undefined
	let claimRouteError: string | undefined
	let claimApiError: string | undefined
	let supSubgraphError: string | undefined
	let protocolSubgraphError: string | undefined
	let rpcError: string | undefined

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

	try {
		claimApiProgramApps = await discoverClaimApiProgramApps(cache, stats)
		claimApiProgramIds = uniqSorted(
			claimApiProgramApps.map(getClaimProgramId).filter((id): id is number => typeof id === "number"),
		)
	} catch (error) {
		claimApiError = error instanceof Error ? error.message : String(error)
	}

	try {
		supSubgraphPrograms = await fetchSupSubgraphPrograms(cache, stats)
		supSubgraphProgramIds = uniqSorted(
			supSubgraphPrograms
				.map((program) => Number.parseInt(program.id, 10))
				.filter((id) => Number.isInteger(id) && id > 0),
		)
	} catch (error) {
		supSubgraphError = error instanceof Error ? error.message : String(error)
	}

	try {
		rpcProgramPools = await fetchRpcProgramPools(supSubgraphProgramIds, concurrency)
	} catch (error) {
		rpcError = error instanceof Error ? error.message : String(error)
	}

	try {
		const poolAddresses = [
			...supSubgraphPrograms.map((program) => program.distributionPool),
			...Array.from(rpcProgramPools.values()).map((program) => program.poolAddress),
		]
		protocolPools = await fetchProtocolPools(poolAddresses, cache, stats, Math.min(concurrency, 16))
	} catch (error) {
		protocolSubgraphError = error instanceof Error ? error.message : String(error)
	}

	balanceBatchCampaignIds = await discoverExistingCampaignIdsWithBalanceBatch(
		baseUrl,
		maxCampaignId,
		cache,
		stats,
		concurrency,
	)
	const allDiscoveredIds = uniqSorted([
		...backendCampaignIds,
		...supSubgraphProgramIds,
		...balanceBatchCampaignIds,
	])
	const ids = explicitCampaignIds || allDiscoveredIds
	const campaigns = await mapConcurrent(ids, concurrency, (campaignId) =>
		fetchCampaign(baseUrl, campaignId, cache, stats),
	)
	const resolvedCampaigns = campaigns
		.filter((campaign): campaign is CampaignMetadata => !!campaign)
		.sort((a, b) => a.campaignId - b.campaignId)
	const resolvedCampaignIds = resolvedCampaigns.map((campaign) => campaign.campaignId)
	const missingFromCms = ids.filter((id) => !resolvedCampaignIds.includes(id))
	const claimAppsByProgramId = mapClaimAppsByProgramId(claimApiProgramApps)
	const supProgramsById = new Map(
		supSubgraphPrograms
			.map((program) => [Number.parseInt(program.id, 10), program] as const)
			.filter(([id]) => Number.isInteger(id) && id > 0),
	)
	const resolvedCampaignIdSet = new Set(resolvedCampaignIds)
	const records = ids.map((id) => {
		const supProgram = supProgramsById.get(id)
		const rpcPool = rpcProgramPools.get(id)
		const poolAddress = rpcPool?.poolAddress || supProgram?.distributionPool
		return {
			id,
			claimApps: claimAppsByProgramId.get(id) || [],
			cmsExists: resolvedCampaignIdSet.has(id),
			supProgram,
			rpcPool,
			protocolPool: poolAddress ? protocolPools.get(poolAddress.toLowerCase()) : undefined,
		} satisfies CampaignDiscoveryRecord
	})
	const onchainOnlyIds = records.filter((record) => record.supProgram && !record.cmsExists).map((record) => record.id)
	const cmsOnlyIds = records
		.filter((record) => record.cmsExists && !record.supProgram && record.claimApps.length === 0)
		.map((record) => record.id)

	return {
		campaigns: resolvedCampaigns,
		discoveryDetails: {
			source: explicitCampaignIds
				? "explicit-campaign-ids-with-sup-subgraph-rpc-protocol-claim-api-and-cms-cross-check"
				: `sup-subgraph-primary-plus-rpc-verification-protocol-enrichment-claim-attribution-and-cms-balance-batch-1-to-${maxCampaignId}`,
			backendSchema: 'Payload collection "campaigns" / table "campaigns" / id numeric',
			backendCampaignIds,
			claimRouteProgramIds,
			claimApiProgramIds,
			supSubgraphProgramIds,
			balanceBatchCampaignIds,
			allDiscoveredIds,
			explicitCampaignIds,
			resolvedCampaignIds,
			missingFromCms,
			onchainOnlyIds,
			cmsOnlyIds,
			maxCampaignId,
			cachePath: path.resolve(getArgValue("cache") || DEFAULT_CACHE_PATH),
			cacheHits: stats.hits,
			cacheWrites: stats.writes,
			backendDiscoveryError,
			claimRouteError,
			claimApiError,
			supSubgraphError,
			protocolSubgraphError,
			rpcError,
			claimRouteNote:
				"Legacy fallback: uses the same Next.js server action as claim.superfluid.org getProgramApps to list onchain program IDs.",
			claimApiNote:
				"Uses https://claim.superfluid.org/api/programs only for human-readable claim-app attribution such as app IDs, names, seasons, and claim-app onchainInfo; it is not the primary existence source.",
			rpcNote:
				"Uses direct Base RPC to verify FluidEPProgramManager.getProgramPool(programId) for each SUP Program and read the pool getTotalFlowRate for current state.",
			supSubgraphNote:
				"Uses the SUP Goldsky subgraph to enumerate onchain emission Program entities and lifecycle fields such as distributionPool, endDate, stoppedDate, and cancellationDate.",
			protocolSubgraphNote:
				"Uses the Base protocol-v1 subgraph to bulk-enrich discovered SUP pools with indexed GDA pool flow rate, total members, units, and distributed amount. Pool updatedAtTimestamp is not treated as last-SUP-flow time; direct RPC is preferred for current flow.",
			batchEndpointNote:
				"Checked the backend API registry: POST batch endpoints exist for balances/signatures, but there is no public POST campaign-metadata batch endpoint, so hidden campaign discovery also uses /points/balance-batch in chunks of 50 to find existing offchain CMS IDs through the configured maximum.",
			pointsSubgraphNote:
				"No separate point-event subgraph endpoint was found in this repo/config; event names are sampled or fetched from the offchain CMS /points/events endpoint.",
			records,
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
	const discoveryHtml = `<section><h2>Campaign enumeration</h2><table><tbody><tr><th>Source used</th><td>${escapeHtml(discoveryDetails.source)}</td></tr><tr><th>Backend schema</th><td><code>${escapeHtml(discoveryDetails.backendSchema)}</code>${discoveryDetails.backendDiscoveryError ? `<br><span class="muted">Backend discovery failed: ${escapeHtml(discoveryDetails.backendDiscoveryError)}</span>` : ""}</td></tr><tr><th>Claim programs API</th><td>${escapeHtml(discoveryDetails.claimApiNote)}${discoveryDetails.claimApiError ? `<br><span class="muted">Claim API failed: ${escapeHtml(discoveryDetails.claimApiError)}</span>` : ""}</td></tr><tr><th>SUP subgraph</th><td>${escapeHtml(discoveryDetails.supSubgraphNote)}${discoveryDetails.supSubgraphError ? `<br><span class="muted">SUP subgraph failed: ${escapeHtml(discoveryDetails.supSubgraphError)}</span>` : ""}</td></tr><tr><th>Direct RPC</th><td>${escapeHtml(discoveryDetails.rpcNote)}${discoveryDetails.rpcError ? `<br><span class="muted">RPC failed: ${escapeHtml(discoveryDetails.rpcError)}</span>` : ""}</td></tr><tr><th>Protocol subgraph</th><td>${escapeHtml(discoveryDetails.protocolSubgraphNote)}${discoveryDetails.protocolSubgraphError ? `<br><span class="muted">Protocol subgraph failed: ${escapeHtml(discoveryDetails.protocolSubgraphError)}</span>` : ""}</td></tr><tr><th>Claim app route</th><td>${escapeHtml(discoveryDetails.claimRouteNote)}${discoveryDetails.claimRouteError ? `<br><span class="muted">Claim route failed: ${escapeHtml(discoveryDetails.claimRouteError)}</span>` : ""}</td></tr><tr><th>Public CMS scan range</th><td><code>1..${discoveryDetails.maxCampaignId}</code></td></tr><tr><th>Cache</th><td><code>${escapeHtml(discoveryDetails.cachePath)}</code> · ${discoveryDetails.cacheHits} hits · ${discoveryDetails.cacheWrites} writes</td></tr><tr><th>Backend campaign IDs</th><td>${renderIdList(discoveryDetails.backendCampaignIds)}</td></tr><tr><th>Claim API program IDs</th><td>${renderIdList(discoveryDetails.claimApiProgramIds)}</td></tr><tr><th>Claim route program IDs</th><td>${renderIdList(discoveryDetails.claimRouteProgramIds)}</td></tr><tr><th>SUP subgraph program IDs</th><td>${renderIdList(discoveryDetails.supSubgraphProgramIds)}</td></tr><tr><th>Balance-batch campaign IDs</th><td>${renderIdList(discoveryDetails.balanceBatchCampaignIds)}</td></tr><tr><th>All discovered IDs</th><td>${renderIdList(discoveryDetails.allDiscoveredIds)}</td></tr><tr><th>Explicit campaign IDs</th><td>${discoveryDetails.explicitCampaignIds?.length ? renderIdList(discoveryDetails.explicitCampaignIds) : '<span class="muted">Not used.</span>'}</td></tr><tr><th>Resolved offchain CMS IDs</th><td>${renderIdList(discoveryDetails.resolvedCampaignIds)}</td></tr><tr><th>Missing from offchain CMS</th><td>${renderIdList(discoveryDetails.missingFromCms)}</td></tr><tr><th>Onchain-only IDs</th><td>${renderIdList(discoveryDetails.onchainOnlyIds)}</td></tr><tr><th>CMS-only IDs</th><td>${renderIdList(discoveryDetails.cmsOnlyIds)}</td></tr><tr><th>POST batch endpoint check</th><td>${escapeHtml(discoveryDetails.batchEndpointNote)}</td></tr><tr><th>Point-event subgraph cross-check</th><td>${escapeHtml(discoveryDetails.pointsSubgraphNote)}</td></tr></tbody></table><h3>All discovered claim/CMS/onchain IDs</h3><table><thead><tr><th>ID</th><th>Attribution</th><th>Claim apps</th><th>CMS</th><th>SUP subgraph</th><th>RPC pool verified</th><th>RPC flow</th><th>Indexed flow</th><th>End</th><th>Stopped</th><th>Pool members</th></tr></thead><tbody>${renderCampaignDiscoveryRows(discoveryDetails.records)}</tbody></table></section>`

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

	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Point event names by campaign</title><style>body{font-family:Inter,Arial,sans-serif;line-height:1.5;margin:2rem;color:#101828;background:#fff}main{max-width:1100px;margin:auto}h1{margin-bottom:.25rem}section{margin-top:2.5rem}table{width:100%;border-collapse:collapse;margin-top:1rem}th,td{border:1px solid #d0d5dd;padding:.65rem;text-align:left;vertical-align:top}th{background:#f2f4f7}code{background:#f9fafb;border:1px solid #eaecf0;border-radius:4px;padding:.1rem .25rem}.muted{color:#667085;font-weight:400}ul{margin:0;padding-left:1.25rem}</style></head><body><main><h1>Point event names by campaign</h1><p class="muted">Generated ${escapeHtml(generatedAt)} from <code>${escapeHtml(baseUrl)}</code>. Campaigns are discovered from SUP Goldsky subgraph Program entities first, then direct RPC verifies <code>getProgramPool(programId)</code> and current <code>getTotalFlowRate</code>, the protocol subgraph bulk-enriches pool state, claim <code>/api/programs</code> adds season/name/app attribution, and parallel cached POSTs to CMS <code>/points/balance-batch</code> identify CMS-only/offchain campaign IDs in chunks of 50 through <code>${discoveryDetails.maxCampaignId}</code>. Onchain programs are enriched from the Base protocol-v1 subgraph; pool update timestamps are intentionally not treated as last-SUP-flow times. Season 6+ campaigns and configured in-progress pre-season-6 campaigns (<code>${fullPreSeason6CampaignIds.join(",")}</code>) fetch all event pages; finished pre-season-6 campaigns fetch only the first 100 and final 100 events. Hash-like trailing suffixes matching <code>-(?:0x)?[a-f0-9]{8,}</code> are coalesced to <code>-{hash}</code>.</p><p>${summaries.length} CMS campaigns, ${totalNames} coalesced event names, ${totalEvents} observed point events.</p>${discoveryHtml}${campaignSections}</main></body></html>\n`

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
