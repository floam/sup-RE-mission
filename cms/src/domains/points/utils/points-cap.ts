import { eq, sum } from "@payloadcms/db-vercel-postgres/drizzle"
import type { BasePayload } from "payload"
import { point_balances } from "@/payload-drizzle-schema"

/** Maximum percentage of total campaign points a single user can receive. */
const CAP_PERCENTAGE = 0.05

/** Minimum cap value so early claimers aren't unfairly limited. */
const CAP_MINIMUM = 500

/**
 * Fetches the total points distributed in a campaign using a DB aggregate.
 */
export async function getCampaignTotalPoints(payload: BasePayload, campaignId: number): Promise<number> {
	const result = await payload.db.drizzle
		.select({
			totalPoints: sum(point_balances.totalPoints),
		})
		.from(point_balances)
		.where(eq(point_balances.campaign, campaignId))

	return Number(result[0]?.totalPoints ?? 0)
}

/**
 * Applies the points cap: a user's signed points are limited to
 * max(CAP_MINIMUM, CAP_PERCENTAGE * totalCampaignPoints).
 *
 * If the user's actual points are below the cap, they're returned as-is.
 * Points of 0 or negative are never capped upward.
 */
export function applyPointsCap(userPoints: number, totalCampaignPoints: number): number {
	if (userPoints <= 0) {
		return userPoints
	}

	const cap = Math.max(CAP_MINIMUM, Math.floor(totalCampaignPoints * CAP_PERCENTAGE))
	return Math.min(userPoints, cap)
}
