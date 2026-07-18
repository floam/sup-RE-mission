import { and, eq, sum } from "@payloadcms/db-vercel-postgres/drizzle"
import { isAddress } from "viem"
import type { EventBalanceResponse } from "@/domains/points/types"
import { getPayloadInstance } from "@/payload"
import { point_events } from "@/payload-drizzle-schema"

/**
 * GET /points/event-balance?campaignId=42&eventName=swap
 * GET /points/event-balance?campaignId=42&eventName=swap&account=0x...
 *
 * Returns aggregated points for a specific event type.
 * - With account: Returns sum for that account
 * - Without account: Returns sum across all accounts
 */
export const maxDuration = 30

export const GET = async (request: Request): Promise<Response> => {
	try {
		const url = new URL(request.url)

		// Get campaignId parameter (required)
		const campaignIdParam = url.searchParams.get("campaignId")
		if (!campaignIdParam) {
			return Response.json({ message: "Missing required query parameter: campaignId" }, { status: 400 })
		}

		const campaignId = parseInt(campaignIdParam, 10)
		if (Number.isNaN(campaignId) || campaignId <= 0) {
			return Response.json({ message: "campaignId must be a positive integer" }, { status: 400 })
		}

		// Get eventName parameter (required)
		const eventName = url.searchParams.get("eventName")
		if (!eventName) {
			return Response.json({ message: "Missing required query parameter: eventName" }, { status: 400 })
		}

		if (eventName.length > 100) {
			return Response.json({ message: "eventName must be at most 100 characters" }, { status: 400 })
		}

		// Get optional account parameter
		const accountParam = url.searchParams.get("account")
		let account: string | undefined

		if (accountParam) {
			account = accountParam.toLowerCase()
			if (!isAddress(account)) {
				return Response.json({ message: "Invalid Ethereum address" }, { status: 400 })
			}
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

		// Build Drizzle conditions for DB-side SUM aggregation
		const conditions = [eq(point_events.campaign, campaignId), eq(point_events.eventName, eventName)]

		if (account) {
			conditions.push(eq(point_events.account, account))
		}

		const result = await payload.db.drizzle
			.select({ totalPoints: sum(point_events.points) })
			.from(point_events)
			.where(and(...conditions))

		const points = Number(result[0]?.totalPoints ?? 0)

		// Build response - always include eventName, include account only if provided
		const response: EventBalanceResponse = { eventName, points }
		if (account) {
			response.account = account
		}

		return Response.json(response)
	} catch (error) {
		console.error("Failed to query event balance:", error)

		return Response.json(
			{
				message: error instanceof Error ? error.message : "Failed to query event balance",
			},
			{ status: 500 },
		)
	}
}
