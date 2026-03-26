import CoinGecko from "@coingecko/coingecko-typescript"
import sfMeta from "@superfluid-finance/metadata"
import { unstable_cache } from "next/cache"
import { zeroAddress } from "viem"
import { getCacheProvider, PRICE_CACHE_TTL, priceCacheKey } from "@/utils/cache"
import { createStorageProvider, getPricingStorageConfig } from "@/utils/storage"

const MAX_ADDRESSES = 50

interface SuperTokenData {
	address: string
	chainId: number
	symbol: string
	name: string
	decimals: number
	isListed: boolean
	isNativeAssetSuperToken: boolean
	isPureSuperToken: boolean
	isWrapperSuperToken: boolean
	underlyingAddress: string | null
	lastUpdated: string
}

interface NetworkTokenData {
	version: string
	timestamp: string
	network: { chainId: number; name: string; endpoint: string }
	totalTokens: number
	tokens: SuperTokenData[]
}

interface CoinGeckoMappings {
	mappings: Record<string, Record<string, string>>
	metadata?: {
		chainIdToPlatformIds?: Record<string, string>
	}
}

interface CoinGeckoSimplePriceResponse {
	[coinId: string]: {
		usd?: number
	}
}

interface OnchainTokenPriceResponse {
	data?: {
		attributes?: {
			token_prices?: Record<string, string>
		}
	}
}

interface CurrentPriceResponse {
	chainId: number
	address: string
	symbol: string | null
	priceUsd: string | null
	fetchedAt: string
	method: "classic" | "onchain" | "none"
}

const getCachedNetworkTokens = unstable_cache(
	async (networkName: string): Promise<NetworkTokenData | null> => {
		const storage = createStorageProvider(getPricingStorageConfig())
		const raw = await storage.get(`super-tokens/latest/${networkName}.json`)
		if (!raw) return null
		return JSON.parse(raw) as NetworkTokenData
	},
	["network-tokens"],
	{ revalidate: 21600 }, // 6 hours
)

const getCachedMappings = unstable_cache(
	async (): Promise<CoinGeckoMappings | null> => {
		const storage = createStorageProvider(getPricingStorageConfig())
		const raw = await storage.get("coingecko-mappings/super-token-ids.json")
		if (!raw) return null
		return JSON.parse(raw) as CoinGeckoMappings
	},
	["coingecko-mappings"],
	{ revalidate: 43200 }, // 12 hours
)

function getCoinGeckoClient() {
	if (!process.env.COINGECKO_API_KEY) {
		throw new Error("COINGECKO_API_KEY environment variable is not set")
	}

	return new CoinGecko({
		proAPIKey: process.env.COINGECKO_API_KEY,
		timeout: 5000,
		maxRetries: 2,
	})
}

/**
 * Batch-fetch prices for tokens that have CoinGecko IDs.
 * Uses comma-separated IDs in a single API call.
 */
async function fetchClassicBatchPrices(coingeckoIds: string[]): Promise<Map<string, string>> {
	const client = getCoinGeckoClient()
	const result = new Map<string, string>()

	if (coingeckoIds.length === 0) return result

	try {
		const response = await client.simple.price.get({
			vs_currencies: "usd",
			ids: coingeckoIds.join(","),
		})

		const priceData = response as CoinGeckoSimplePriceResponse
		for (const id of coingeckoIds) {
			const price = priceData[id]?.usd
			if (price !== undefined && price !== null) {
				result.set(id, price.toString())
			}
		}
	} catch (error) {
		console.error("Error fetching classic batch prices:", error)
	}

	return result
}

/**
 * Batch-fetch prices for tokens via onchain/DEX API.
 * All addresses must be on the same platform (single chain).
 */
async function fetchOnchainBatchPrices(tokens: SuperTokenData[], platformId: string): Promise<Map<string, string>> {
	const client = getCoinGeckoClient()
	const result = new Map<string, string>()

	if (tokens.length === 0) return result

	// Build address list: use underlying address when available (except native asset super tokens)
	const addressMap = new Map<string, string>() // queryAddress → original token address
	for (const token of tokens) {
		const queryAddr =
			token.underlyingAddress && token.underlyingAddress !== zeroAddress && !token.isNativeAssetSuperToken
				? token.underlyingAddress.toLowerCase()
				: token.address.toLowerCase()
		addressMap.set(queryAddr, token.address.toLowerCase())
	}

	const queryAddresses = Array.from(addressMap.keys())

	try {
		const response = await client.onchain.simple.networks.tokenPrice.getAddresses(queryAddresses.join(","), {
			network: platformId,
		})

		const responseData = response as OnchainTokenPriceResponse
		const tokenPrices = responseData.data?.attributes?.token_prices

		if (tokenPrices) {
			for (const [queryAddr, originalAddr] of addressMap) {
				const price = tokenPrices[queryAddr]
				if (price && typeof price === "string") {
					result.set(originalAddr, price)
				}
			}
		}
	} catch (error) {
		console.error("Error fetching onchain batch prices:", error)
	}

	return result
}

export async function POST(request: Request, context: { params: Promise<{ chainId: string }> }) {
	try {
		const params = await context.params
		const { chainId } = params

		// Validate chainId
		const chainIdNum = parseInt(chainId, 10)
		if (Number.isNaN(chainIdNum)) {
			return Response.json({ error: "Invalid chainId", message: "chainId must be a number" }, { status: 400 })
		}

		// Parse and validate body
		let body: unknown
		try {
			body = await request.json()
		} catch {
			return Response.json({ error: "Invalid JSON", message: "Request body must be valid JSON" }, { status: 400 })
		}

		const { addresses } = body as { addresses?: unknown }

		if (!Array.isArray(addresses) || addresses.length === 0) {
			return Response.json(
				{ error: "Invalid request", message: "addresses must be a non-empty array" },
				{ status: 400 },
			)
		}

		if (addresses.length > MAX_ADDRESSES) {
			return Response.json(
				{ error: "Too many addresses", message: `Maximum ${MAX_ADDRESSES} addresses per request` },
				{ status: 400 },
			)
		}

		// Validate all addresses
		const addressRegex = /^0x[a-fA-F0-9]{40}$/
		const invalidAddresses = addresses.filter((a) => typeof a !== "string" || !addressRegex.test(a))
		if (invalidAddresses.length > 0) {
			return Response.json(
				{
					error: "Invalid addresses",
					message: "All addresses must be valid Ethereum addresses",
					invalid: invalidAddresses,
				},
				{ status: 400 },
			)
		}

		// Map chainId to network
		const network = sfMeta.networks.find((n) => n.chainId === chainIdNum)
		if (!network) {
			return Response.json(
				{ error: "Unsupported chain", message: `Chain ${chainIdNum} is not a supported Superfluid network` },
				{ status: 400 },
			)
		}

		// Load cached data
		const [networkData, coingeckoMappings] = await Promise.all([
			getCachedNetworkTokens(network.name),
			getCachedMappings(),
		])

		if (!networkData) {
			return Response.json({ error: "No super token data found" }, { status: 404 })
		}

		if (!coingeckoMappings) {
			return Response.json({ error: "CoinGecko mappings not available", code: "MAPPINGS_UNAVAILABLE" }, { status: 503 })
		}

		const fetchedAt = new Date().toISOString()
		const chainMappings = coingeckoMappings.mappings[chainIdNum.toString()] ?? {}
		const platformId = coingeckoMappings.metadata?.chainIdToPlatformIds?.[chainIdNum.toString()]

		// Build token index for fast lookups
		const tokenIndex = new Map<string, SuperTokenData>()
		for (const t of networkData.tokens) {
			tokenIndex.set(t.address.toLowerCase(), t)
		}

		// Check cache for each address
		const cache = getCacheProvider()
		const results: CurrentPriceResponse[] = []
		const uncachedIndices: number[] = [] // indices in results that need fetching

		for (const addr of addresses as string[]) {
			const addrLower = addr.toLowerCase()
			const index = results.length
			const cached = await cache.get(priceCacheKey(chainIdNum, addrLower))

			if (cached) {
				results.push(JSON.parse(cached) as CurrentPriceResponse)
				continue
			}

			const token = tokenIndex.get(addrLower)

			if (!token) {
				results.push({
					chainId: chainIdNum,
					address: addr,
					symbol: null,
					priceUsd: null,
					fetchedAt,
					method: "none",
				})
				continue
			}

			// Push placeholder — will be filled after batch fetch
			uncachedIndices.push(index)
			results.push({
				chainId: chainIdNum,
				address: token.address,
				symbol: token.symbol,
				priceUsd: null,
				fetchedAt,
				method: "none",
			})
		}

		// Group uncached tokens by pricing method
		const classicTokens: { token: SuperTokenData; coingeckoId: string; resultIdx: number }[] = []
		const onchainTokens: { token: SuperTokenData; resultIdx: number }[] = []

		for (const idx of uncachedIndices) {
			const addrLower = results[idx].address.toLowerCase()
			const token = tokenIndex.get(addrLower)
			if (!token) continue

			const coingeckoId = chainMappings[addrLower]
			if (coingeckoId) {
				classicTokens.push({ token, coingeckoId, resultIdx: idx })
			} else if (platformId) {
				onchainTokens.push({ token, resultIdx: idx })
			}
		}

		// Batch-fetch prices in parallel (only for cache misses)
		const [classicPrices, onchainPrices] = await Promise.all([
			fetchClassicBatchPrices(classicTokens.map((t) => t.coingeckoId)),
			platformId
				? fetchOnchainBatchPrices(
						onchainTokens.map((t) => t.token),
						platformId,
					)
				: Promise.resolve(new Map<string, string>()),
		])

		// Fill in classic prices
		for (const { token, coingeckoId, resultIdx } of classicTokens) {
			results[resultIdx].method = "classic"
			const price = classicPrices.get(coingeckoId)
			if (price) {
				results[resultIdx].priceUsd = price
			}
		}

		// Fill in onchain prices
		for (const { token, resultIdx } of onchainTokens) {
			results[resultIdx].method = "onchain"
			const price = onchainPrices.get(token.address.toLowerCase())
			if (price) {
				results[resultIdx].priceUsd = price
			}
		}

		// Store all uncached results in cache
		await Promise.all(
			uncachedIndices.map((idx) => {
				const result = results[idx]
				return cache.set(priceCacheKey(chainIdNum, result.address), JSON.stringify(result), PRICE_CACHE_TTL)
			}),
		)

		return Response.json(results, {
			headers: {
				"Cache-Control": "no-store",
			},
		})
	} catch (error) {
		console.error("Error fetching batch prices:", error)
		return Response.json(
			{
				error: "Failed to fetch batch prices",
				code: "INTERNAL_ERROR",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		)
	}
}
