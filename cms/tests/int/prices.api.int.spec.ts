import { fetchLatestExtendedSuperTokenList } from "@superfluid-finance/tokenlist"
import { beforeAll, describe, expect, it } from "vitest"

const BASE_URL = "http://localhost:3000"

// Control how many tokens to test. Default 5 for safe initial runs.
// Set MAX_TOKENS=0 to test all listed tokens.
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || "5", 10)

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface TestToken {
	chainId: number
	address: string
	symbol: string
}

let listedTokens: TestToken[]

describe("Prices API", () => {
	beforeAll(async () => {
		const tokenList = await fetchLatestExtendedSuperTokenList()

		// Filter to super tokens only (exclude underlying tokens)
		// and sort by chainId for diverse coverage across chains
		const allTokens = tokenList.tokens
			.filter((t) => t.extensions?.superTokenInfo)
			.map((t) => ({ chainId: t.chainId, address: t.address, symbol: t.symbol }))
			.sort((a, b) => a.chainId - b.chainId)

		listedTokens = MAX_TOKENS > 0 ? allTokens.slice(0, MAX_TOKENS) : allTokens

		console.log(
			`Testing ${listedTokens.length} of ${allTokens.length} tokenlist tokens (MAX_TOKENS=${MAX_TOKENS || "all"})`,
		)
		console.log("Tokens:", listedTokens.map((t) => `${t.symbol} (${t.chainId})`).join(", "))
	}, 30_000)

	describe("Input Validation", () => {
		describe("GET /prices/{chainId}/{address}/current", () => {
			it("should return 400 for non-numeric chainId", async () => {
				const res = await fetch(`${BASE_URL}/prices/abc/0x1234567890123456789012345678901234567890/current`)
				expect(res.status).toBe(400)
				const data = await res.json()
				expect(data).toHaveProperty("error")
			})

			it("should return 400 for invalid address", async () => {
				const res = await fetch(`${BASE_URL}/prices/1/0xinvalid/current`)
				expect(res.status).toBe(400)
				const data = await res.json()
				expect(data).toHaveProperty("error")
			})

			it("should return 404 for non-existent token", async () => {
				const res = await fetch(`${BASE_URL}/prices/1/0x0000000000000000000000000000000000000001/current`)
				expect(res.status).toBe(404)
				const data = await res.json()
				expect(data).toHaveProperty("error")
			})
		})

		describe("GET /prices/{chainId}/{address}", () => {
			it("should return 400 for non-numeric chainId", async () => {
				const res = await fetch(`${BASE_URL}/prices/abc/0x1234567890123456789012345678901234567890`)
				expect(res.status).toBe(400)
				const data = await res.json()
				expect(data).toHaveProperty("error")
			})

			it("should return 400 for invalid address", async () => {
				const res = await fetch(`${BASE_URL}/prices/1/0xinvalid`)
				expect(res.status).toBe(400)
				const data = await res.json()
				expect(data).toHaveProperty("error")
			})

			it("should return 404 for non-existent token", async () => {
				const res = await fetch(`${BASE_URL}/prices/1/0x0000000000000000000000000000000000000001`)
				// Could be 404 or 500 depending on Payload's findByID behavior for missing IDs
				expect([404, 500]).toContain(res.status)
			})
		})
	})

	describe("GET /prices/{chainId}/{address}/current — listed tokens", () => {
		it("should return valid current price data for all tested tokens", async () => {
			expect(listedTokens.length).toBeGreaterThan(0)

			const failures: string[] = []
			const results = { classic: 0, onchain: 0, none: 0 }

			for (const token of listedTokens) {
				const res = await fetch(`${BASE_URL}/prices/${token.chainId}/${token.address}/current`)

				try {
					// 503 means CoinGecko mappings unavailable — infrastructure issue, not token issue
					if (res.status === 503) {
						failures.push(`${token.symbol} (${token.chainId}): 503 — CoinGecko mappings unavailable`)
						continue
					}

					expect(res.status).toBe(200)
					const data = await res.json()

					// Response structure
					expect(data).toHaveProperty("chainId")
					expect(data).toHaveProperty("address")
					expect(data).toHaveProperty("symbol")
					expect(data).toHaveProperty("priceUsd")
					expect(data).toHaveProperty("fetchedAt")
					expect(data).toHaveProperty("method")

					// Method validation
					expect(["classic", "onchain", "none"]).toContain(data.method)
					results[data.method as keyof typeof results]++

					// Token matches request
					expect(data.chainId).toBe(token.chainId)
					expect(data.address.toLowerCase()).toBe(token.address.toLowerCase())

					// fetchedAt is valid ISO string
					expect(new Date(data.fetchedAt).toISOString()).toBe(data.fetchedAt)

					// If priceUsd is not null, it should be a valid positive number
					if (data.priceUsd !== null) {
						expect(typeof data.priceUsd).toBe("string")
						const price = Number(data.priceUsd)
						expect(price).not.toBeNaN()
						expect(price).toBeGreaterThan(0)
					}
				} catch (e) {
					failures.push(`${token.symbol} (${token.chainId}:${token.address}): ${e instanceof Error ? e.message : e}`)
				}

				// Conservative delay to respect CoinGecko rate limits
				await delay(500)
			}

			console.log(`Current price results: classic=${results.classic}, onchain=${results.onchain}, none=${results.none}`)

			if (failures.length > 0) {
				throw new Error(`Failures for ${failures.length}/${listedTokens.length} tokens:\n${failures.join("\n")}`)
			}
		}, 600_000)
	})

	describe("POST /prices/{chainId}/current — batch endpoint", () => {
		describe("Input Validation", () => {
			it("should return 400 for non-numeric chainId", async () => {
				const res = await fetch(`${BASE_URL}/prices/abc/current`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ addresses: ["0x1234567890123456789012345678901234567890"] }),
				})
				expect(res.status).toBe(400)
				const data = await res.json()
				expect(data).toHaveProperty("error")
			})

			it("should return 400 for empty addresses array", async () => {
				const res = await fetch(`${BASE_URL}/prices/1/current`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ addresses: [] }),
				})
				expect(res.status).toBe(400)
				const data = await res.json()
				expect(data).toHaveProperty("error")
			})

			it("should return 400 for missing addresses", async () => {
				const res = await fetch(`${BASE_URL}/prices/1/current`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({}),
				})
				expect(res.status).toBe(400)
				const data = await res.json()
				expect(data).toHaveProperty("error")
			})

			it("should return 400 for invalid address format", async () => {
				const res = await fetch(`${BASE_URL}/prices/1/current`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ addresses: ["0xinvalid"] }),
				})
				expect(res.status).toBe(400)
				const data = await res.json()
				expect(data).toHaveProperty("error")
			})

			it("should return 400 for too many addresses", async () => {
				const addresses = Array.from({ length: 51 }, (_, i) => `0x${i.toString(16).padStart(40, "0")}`)
				const res = await fetch(`${BASE_URL}/prices/1/current`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ addresses }),
				})
				expect(res.status).toBe(400)
				const data = await res.json()
				expect(data).toHaveProperty("error")
			})
		})

		it("should return valid batch price data for listed tokens", async () => {
			expect(listedTokens.length).toBeGreaterThan(0)

			// Group tokens by chainId and pick the first chain that has multiple tokens
			const byChain = new Map<number, TestToken[]>()
			for (const token of listedTokens) {
				const group = byChain.get(token.chainId) || []
				group.push(token)
				byChain.set(token.chainId, group)
			}

			// Use all tokens from the first chain, or just the first token if all are on different chains
			const [testChainId, testTokens] = Array.from(byChain.entries())[0]
			const testAddresses = testTokens.map((t) => t.address)

			console.log(`Batch test: ${testAddresses.length} tokens on chain ${testChainId}`)

			const res = await fetch(`${BASE_URL}/prices/${testChainId}/current`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ addresses: testAddresses }),
			})

			// 503 means CoinGecko mappings unavailable — infrastructure issue
			if (res.status === 503) {
				console.log("Skipping batch test: CoinGecko mappings unavailable (503)")
				return
			}

			expect(res.status).toBe(200)
			const data = await res.json()

			// Response should be an array
			expect(Array.isArray(data)).toBe(true)
			expect(data.length).toBe(testAddresses.length)

			// Each item should have the same shape as single endpoint
			for (const item of data) {
				expect(item).toHaveProperty("chainId")
				expect(item).toHaveProperty("address")
				expect(item).toHaveProperty("symbol")
				expect(item).toHaveProperty("priceUsd")
				expect(item).toHaveProperty("fetchedAt")
				expect(item).toHaveProperty("method")
				expect(item.chainId).toBe(testChainId)
				expect(["classic", "onchain", "none"]).toContain(item.method)

				if (item.priceUsd !== null) {
					expect(typeof item.priceUsd).toBe("string")
					const price = Number(item.priceUsd)
					expect(price).not.toBeNaN()
					expect(price).toBeGreaterThan(0)
				}

				// fetchedAt is valid ISO string
				expect(new Date(item.fetchedAt).toISOString()).toBe(item.fetchedAt)
			}
		}, 120_000)

		it("should handle not-found tokens in batch", async () => {
			expect(listedTokens.length).toBeGreaterThan(0)

			const token = listedTokens[0]
			const fakeAddress = "0x0000000000000000000000000000000000000099"

			const res = await fetch(`${BASE_URL}/prices/${token.chainId}/current`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ addresses: [token.address, fakeAddress] }),
			})

			if (res.status === 503) return // CoinGecko mappings unavailable

			expect(res.status).toBe(200)
			const data = await res.json()

			expect(Array.isArray(data)).toBe(true)
			expect(data.length).toBe(2)

			// First token should have data
			expect(data[0].address.toLowerCase()).toBe(token.address.toLowerCase())
			expect(data[0].symbol).toBeTruthy()

			// Second token should be not-found
			expect(data[1].address).toBe(fakeAddress)
			expect(data[1].symbol).toBeNull()
			expect(data[1].priceUsd).toBeNull()
			expect(data[1].method).toBe("none")
		}, 60_000)
	})

	describe("GET /prices/{chainId}/{address} — listed tokens", () => {
		it("should return valid token info for all tested tokens", async () => {
			expect(listedTokens.length).toBeGreaterThan(0)

			const failures: string[] = []

			for (const token of listedTokens) {
				const res = await fetch(`${BASE_URL}/prices/${token.chainId}/${token.address}`)

				try {
					expect(res.status).toBe(200)
					const data = await res.json()

					// Top-level structure
					expect(data).toHaveProperty("version")
					expect(data).toHaveProperty("timestamp")
					expect(data).toHaveProperty("token")
					expect(data).toHaveProperty("coingeckoId")
					expect(data).toHaveProperty("fetchedAt")

					// Token shape
					expect(data.token.chainId).toBe(token.chainId)
					expect(data.token.address.toLowerCase()).toBe(token.address.toLowerCase())
					expect(typeof data.token.symbol).toBe("string")
					expect(typeof data.token.name).toBe("string")
					expect(typeof data.token.decimals).toBe("number")
					expect(typeof data.token.isListed).toBe("boolean")

					// priceHistory should NOT be present without the query param
					expect(data.priceHistory).toBeUndefined()
				} catch (e) {
					failures.push(`${token.symbol} (${token.chainId}:${token.address}): ${e instanceof Error ? e.message : e}`)
				}
			}

			if (failures.length > 0) {
				throw new Error(`Failures for ${failures.length}/${listedTokens.length} tokens:\n${failures.join("\n")}`)
			}
		}, 300_000)

		it("should return valid price history when available", async () => {
			expect(listedTokens.length).toBeGreaterThan(0)

			const results = { success: 0, notFound: 0 }
			const failures: string[] = []

			for (const token of listedTokens) {
				const res = await fetch(`${BASE_URL}/prices/${token.chainId}/${token.address}?includePriceHistory=true`)

				try {
					if (res.status === 404) {
						results.notFound++
						continue // Acceptable: price data may not exist for all tokens
					}

					expect(res.status).toBe(200)
					const data = await res.json()

					expect(data).toHaveProperty("priceHistory")
					expect(Array.isArray(data.priceHistory)).toBe(true)

					if (data.priceHistory.length > 0) {
						const point = data.priceHistory[0]
						expect(point).toHaveProperty("date")
						expect(point).toHaveProperty("price")
						expect(typeof point.date).toBe("string")
						expect(typeof point.price).toBe("string")
					}

					results.success++
				} catch (e) {
					failures.push(`${token.symbol} (${token.chainId}:${token.address}): ${e instanceof Error ? e.message : e}`)
				}
			}

			console.log(
				`Price history results: ${results.success} ok, ${results.notFound} not found, ${failures.length} failed (of ${listedTokens.length} tested)`,
			)

			if (failures.length > 0) {
				throw new Error(`Failures for ${failures.length}/${listedTokens.length} tokens:\n${failures.join("\n")}`)
			}
		}, 300_000)
	})
})
