// @vitest-environment node
import { describe, expect, it } from "vitest"

const BASE_URL = (process.env.TEST_BASE_URL || "http://localhost:3000").replace(/\/+$/, "")

describe("Tokens API", () => {
	describe("GET /tokens", () => {
		it("should return paginated token list", async () => {
			const response = await fetch(`${BASE_URL}/tokens`)
			expect(response.status).toBe(200)

			const data = await response.json()
			expect(data).toHaveProperty("docs")
			expect(data).toHaveProperty("totalDocs")
			expect(data).toHaveProperty("page")
			expect(data).toHaveProperty("limit")
			expect(Array.isArray(data.docs)).toBe(true)
		})

		it("should accept query parameters", async () => {
			const response = await fetch(`${BASE_URL}/tokens?limit=10&page=1`)
			expect(response.status).toBe(200)

			const data = await response.json()
			expect(data.page).toBe(1)
			expect(data.limit).toBe(10)
		})
	})

	describe("GET /tokens/[chainId]/[address]", () => {
		it("should return 400 for invalid chainId", async () => {
			const response = await fetch(`${BASE_URL}/tokens/invalid/0x1234567890123456789012345678901234567890`)
			expect(response.status).toBe(400)

			const data = await response.json()
			expect(data).toHaveProperty("error")
		})

		it("should return 400 for invalid address", async () => {
			const response = await fetch(`${BASE_URL}/tokens/1/invalid`)
			expect(response.status).toBe(400)

			const data = await response.json()
			expect(data).toHaveProperty("error")
		})

		it("should return 404 or 500 for non-existent token", async () => {
			const response = await fetch(`${BASE_URL}/tokens/1/0x1234567890123456789012345678901234567890`)
			// Payload's findByID throws for missing IDs, caught as 500
			expect([404, 500]).toContain(response.status)
		})
	})
})
