import { count, eq, max, sum } from "@payloadcms/db-vercel-postgres/drizzle"
import type { CampaignMetadataResponse } from "@/domains/points/types"
import { getPayloadInstance } from "@/payload"
import { point_balances, point_events } from "@/payload-drizzle-schema"

/**
 * GET /points/campaign?campaignId=42
 * Query campaign metadata: name, slug, aggregate stats.
 */
export const GET = async (request: Request): Promise<Response> => {
	try {
		const url = new URL(request.url)

		const campaignIdParam = url.searchParams.get("campaignId")
		if (!campaignIdParam) {
			return Response.json({ message: "Missing required query parameter: campaignId" }, { status: 400 })
		}

		const campaignId = parseInt(campaignIdParam, 10)
		if (Number.isNaN(campaignId) || campaignId <= 0) {
			return Response.json({ message: "campaignId must be a positive integer" }, { status: 400 })
		}

		const payload = await getPayloadInstance()

		const campaignResult = await payload.find({
			collection: "campaigns",
			where: { id: { equals: campaignId } },
			limit: 1,
		})

		if (campaignResult.docs.length === 0) {
			return Response.json({ message: "Campaign not found" }, { status: 404 })
		}

		const campaign = campaignResult.docs[0]

		const [balanceStats, eventStats] = await Promise.all([
			payload.db.drizzle
				.select({
					totalPoints: sum(point_balances.totalPoints),
					memberCount: count(),
					lastEventAt: max(point_balances.lastEventAt),
				})
				.from(point_balances)
				.where(eq(point_balances.campaign, campaignId)),
			payload.db.drizzle
				.select({
					totalEvents: count(),
				})
				.from(point_events)
				.where(eq(point_events.campaign, campaignId)),
		])

		const response: CampaignMetadataResponse = {
			campaignId: campaign.id,
			name: campaign.name,
			slug: campaign.slug,
			totalPoints: Number(balanceStats[0]?.totalPoints ?? 0),
			memberCount: balanceStats[0]?.memberCount ?? 0,
			totalEvents: eventStats[0]?.totalEvents ?? 0,
			lastEventAt: balanceStats[0]?.lastEventAt ?? null,
			createdAt: campaign.createdAt,
		}

		return Response.json(response)
	} catch (error) {
		console.error("Failed to query campaign metadata:", error)

		return Response.json(
			{
				message: error instanceof Error ? error.message : "Failed to query campaign metadata",
			},
			{ status: 500 },
		)
	}
}
