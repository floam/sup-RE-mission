import CoinGecko from "@coingecko/coingecko-typescript"
import sfMeta from "@superfluid-finance/metadata"
import { find } from "lodash"
import { unstable_cache } from "next/cache"
import { zeroAddress } from "viem"
import { getCacheProvider, PRICE_CACHE_TTL, priceCacheKey } from "@/utils/cache"
import { createStorageProvider, getPricingStorageConfig } from "@/utils/storage"

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
	symbol: string
	priceUsd: string | null
	fetchedAt: string
	method: "classic" | "onchain" | "none"
}

function getCoinGeckoClient() {
	if (!process.env.COINGECKO_API_KEY) {
		throw new Error("COINGECKO_API_KEY environment variable is not set")
	}

	return new CoinGecko({
		proAPIKey: process.env.COINGECKO_API_KEY,
		timeout: 5000, // 5 second timeout
		maxRetries: 2,
	})
}

async function fetchClassicCurrentPrice(_token: SuperTokenData, coingeckoId: string): Promise<string | null> {
	const client = getCoinGeckoClient()

	try {
		const response = await client.simple.price.get({
			vs_currencies: "usd",
			ids: coingeckoId,
		})

		const priceData = response as CoinGeckoSimplePriceResponse
		const price = priceData[coingeckoId]?.usd

		if (price !== undefined && price !== null) {
			return price.toString()
		}

		return null
	} catch (error) {
		console.error("Error fetching classic price:", error)
		throw error
	}
}

async function fetchOnchainCurrentPrice(token: SuperTokenData, platformId: string): Promise<string | null> {
	const client = getCoinGeckoClient()

	// For onchain API, use underlying token address if available and not a native asset
	const addressToQuery =
		token.underlyingAddress && token.underlyingAddress !== zeroAddress && !token.isNativeAssetSuperToken
			? token.underlyingAddress.toLowerCase()
			: token.address.toLowerCase()

	try {
		const response = await client.onchain.simple.networks.tokenPrice.getAddresses(addressToQuery, {
			network: platformId,
		})

		const responseData = response as OnchainTokenPriceResponse
		const tokenPrices = responseData.data?.attributes?.token_prices
		const tokenData = tokenPrices?.[addressToQuery]

		if (tokenData && typeof tokenData === "string") {
			return tokenData
		}

		return null
	} catch (error) {
		console.error("Error fetching onchain price:", error)
		throw error
	}
}

async function fetchCurrentPrice(
	token: SuperTokenData,
	coingeckoMappings: CoinGeckoMappings,
): Promise<CurrentPriceResponse> {
	const fetchedAt = new Date().toISOString()
	const coingeckoId = coingeckoMappings.mappings[token.chainId.toString()]?.[token.address.toLowerCase()]
	const base = { chainId: token.chainId, address: token.address, symbol: token.symbol, fetchedAt }

	try {
		if (coingeckoId) {
			const price = await fetchClassicCurrentPrice(token, coingeckoId)
			return { ...base, priceUsd: price, method: "classic" as const }
		} else {
			const platformId = coingeckoMappings.metadata?.chainIdToPlatformIds?.[token.chainId.toString()]

			if (!platformId) {
				return { ...base, priceUsd: null, method: "none" as const }
			}

			const price = await fetchOnchainCurrentPrice(token, platformId)
			return { ...base, priceUsd: price, method: "onchain" as const }
		}
	} catch (error) {
		console.error("Failed to fetch current price:", error)
		return { ...base, priceUsd: null, method: coingeckoId ? ("classic" as const) : ("onchain" as const) }
	}
}

export async function GET(_request: Request, context: { params: Promise<{ chainId: string; address: string }> }) {
	try {
		const params = await context.params
		const { chainId, address } = params

		// Parse chainId
		const chainIdNum = parseInt(chainId, 10)
		if (Number.isNaN(chainIdNum)) {
			return Response.json({ error: "Invalid chainId", message: "chainId must be a number" }, { status: 400 })
		}

		// Validate address format
		if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
			return Response.json(
				{ error: "Invalid address", message: "Address must be a valid Ethereum address" },
				{ status: 400 },
			)
		}

		// Map chainId to network name
		const network = sfMeta.networks.find((n) => n.chainId === chainIdNum)
		if (!network) {
			return Response.json(
				{ error: "Unsupported chain", message: `Chain ${chainIdNum} is not a supported Superfluid network` },
				{ status: 400 },
			)
		}

		// Fetch per-network token data (cached 6 hours)
		const networkData = await getCachedNetworkTokens(network.name)
		if (!networkData) {
			return Response.json({ error: "No super token data found" }, { status: 404 })
		}

		// Find specific token in network data
		const token = find(networkData.tokens, (t: SuperTokenData) => t.address.toLowerCase() === address.toLowerCase())

		if (!token) {
			return Response.json(
				{ error: "Token not found", message: `Token ${address} not found on chain ${chainIdNum}` },
				{ status: 404 },
			)
		}

		// Check price cache first
		const cache = getCacheProvider()
		const cacheKey = priceCacheKey(chainIdNum, address)
		const cached = await cache.get(cacheKey)
		if (cached) {
			return Response.json(JSON.parse(cached), {
				headers: {
					"Cache-Control": "public, s-maxage=300",
				},
			})
		}

		// Fetch CoinGecko mappings (cached 12 hours)
		const coingeckoMappings = await getCachedMappings()
		if (!coingeckoMappings) {
			return Response.json({ error: "CoinGecko mappings not available", code: "MAPPINGS_UNAVAILABLE" }, { status: 503 })
		}

		// Fetch current price
		const priceResult = await fetchCurrentPrice(token, coingeckoMappings)

		// Store in cache for sharing with batch endpoint
		await cache.set(cacheKey, JSON.stringify(priceResult), PRICE_CACHE_TTL)

		return Response.json(priceResult, {
			headers: {
				"Cache-Control": "public, s-maxage=300", // Cache for 5 minutes
			},
		})
	} catch (error) {
		console.error("Error fetching current price:", error)
		return Response.json(
			{
				error: "Failed to fetch current price",
				code: "INTERNAL_ERROR",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		)
	}
}

export const revalidate = 300 // 5 minutes
