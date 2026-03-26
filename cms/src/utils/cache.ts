import { Redis } from "@upstash/redis"

export const PRICE_CACHE_TTL = 300 // 5 minutes

export interface CacheProvider {
	get(key: string): Promise<string | null>
	set(key: string, value: string, ttlSeconds: number): Promise<void>
}

class RedisCacheProvider implements CacheProvider {
	private client: Redis

	constructor(url: string, token: string) {
		this.client = new Redis({ url, token })
	}

	async get(key: string): Promise<string | null> {
		try {
			return await this.client.get<string>(key)
		} catch (error) {
			console.error(`Redis cache get failed for key ${key}:`, error)
			return null
		}
	}

	async set(key: string, value: string, ttlSeconds: number): Promise<void> {
		try {
			await this.client.set(key, value, { ex: ttlSeconds })
		} catch (error) {
			console.error(`Redis cache set failed for key ${key}:`, error)
		}
	}
}

class MemoryCacheProvider implements CacheProvider {
	private store = new Map<string, { value: string; expiresAt: number }>()

	async get(key: string): Promise<string | null> {
		const entry = this.store.get(key)
		if (!entry) return null
		if (Date.now() > entry.expiresAt) {
			this.store.delete(key)
			return null
		}
		return entry.value
	}

	async set(key: string, value: string, ttlSeconds: number): Promise<void> {
		this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
	}
}

let cacheProvider: CacheProvider | null = null

export function getCacheProvider(): CacheProvider {
	if (!cacheProvider) {
		const redisUrl = process.env.REDIS_URL
		const redisToken = process.env.REDIS_TOKEN
		if (redisUrl && redisToken) {
			cacheProvider = new RedisCacheProvider(redisUrl, redisToken)
		} else {
			cacheProvider = new MemoryCacheProvider()
		}
	}
	return cacheProvider
}

export function priceCacheKey(chainId: number, address: string): string {
	return `price:current:${chainId}:${address.toLowerCase()}`
}
