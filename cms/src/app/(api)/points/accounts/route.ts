import type { CampaignAccountsResponse } from "@/domains/points/types"
import { getPayloadInstance } from "@/payload"

export const maxDuration = 30

const VALID_ORDER_BY = ["totalPoints", "eventCount", "lastEventAt"] as const

/**
 * GET /points/accounts?campaignId=42
 * Query all accounts in a campaign with their point balances.
 * Supports sorting and pagination for leaderboard display.
 *
 * Query params:
 * - campaignId (required): Campaign ID
 * - orderBy (optional): totalPoints | eventCount | lastEventAt (default: totalPoints)
 * - order (optional): asc | desc (default: desc)
 * - limit (optional): 1-100 (default: 50)
 * - page (optional): positive integer (default: 1)
 */
export const GET = async (request: Request): Promise<Response> => {
	try {
		const url = new URL(request.url)

		// Get campaignId parameter (required, must be numeric)
		const campaignIdParam = url.searchParams.get("campaignId")
		if (!campaignIdParam) {
			return Response.json({ message: "Missing required query parameter: campaignId" }, { status: 400 })
		}

		const campaignId = parseInt(campaignIdParam, 10)
		if (Number.isNaN(campaignId) || campaignId <= 0) {
			return Response.json({ message: "campaignId must be a positive integer" }, { status: 400 })
		}

		// Parse and validate orderBy
		const orderByParam = url.searchParams.get("orderBy")
		let orderBy: (typeof VALID_ORDER_BY)[number] = "totalPoints"
		if (orderByParam) {
			if (!VALID_ORDER_BY.includes(orderByParam as (typeof VALID_ORDER_BY)[number])) {
				return Response.json({ message: `orderBy must be one of: ${VALID_ORDER_BY.join(", ")}` }, { status: 400 })
			}
			orderBy = orderByParam as (typeof VALID_ORDER_BY)[number]
		}

		// Parse and validate order
		const orderParam = url.searchParams.get("order")
		let order: "asc" | "desc" = "desc"
		if (orderParam) {
			if (orderParam !== "asc" && orderParam !== "desc") {
				return Response.json({ message: "order must be 'asc' or 'desc'" }, { status: 400 })
			}
			order = orderParam
		}

		// Parse and validate limit
		const limitParam = url.searchParams.get("limit")
		let limit = 50
		if (limitParam) {
			const parsed = Number.parseInt(limitParam, 10)
			if (Number.isNaN(parsed) || parsed < 1 || parsed > 100) {
				return Response.json({ message: "limit must be between 1 and 100" }, { status: 400 })
			}
			limit = parsed
		}

		// Parse and validate page
		const pageParam = url.searchParams.get("page")
		let page = 1
		if (pageParam) {
			const parsed = Number.parseInt(pageParam, 10)
			if (Number.isNaN(parsed) || parsed < 1) {
				return Response.json({ message: "page must be a positive integer" }, { status: 400 })
			}
			page = parsed
		}

		// Verify campaign exists
		const payload = await getPayloadInstance()
		const campaignResult = await payload.find({
			collection: "campaigns",
			where: { id: { equals: campaignId } },
			limit: 1,
		})

		if (campaignResult.docs.length === 0) {
			return Response.json({ message: "Campaign not found" }, { status: 404 })
		}

		// Build Payload sort string: prefix with "-" for descending
		const sort = order === "desc" ? `-${orderBy}` : orderBy

		// Query point balances for all accounts in the campaign
		const result = await payload.find({
			collection: "point-balances",
			where: {
				campaign: { equals: campaignId },
			},
			sort,
			limit,
			page,
		})

		const response: CampaignAccountsResponse = {
			accounts: result.docs.map((doc) => ({
				account: doc.account,
				totalPoints: doc.totalPoints,
				eventCount: doc.eventCount,
				lastEventAt: doc.lastEventAt ?? null,
			})),
			pagination: {
				page: result.page ?? 1,
				limit: result.limit,
				totalDocs: result.totalDocs,
				totalPages: result.totalPages,
				hasNextPage: result.hasNextPage,
				hasPrevPage: result.hasPrevPage,
			},
		}

		return Response.json(response)
	} catch (error) {
		console.error("Failed to query campaign accounts:", error)

		return Response.json(
			{
				message: error instanceof Error ? error.message : "Failed to query campaign accounts",
			},
			{ status: 500 },
		)
	}
}
