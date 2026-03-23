import { eq, sum } from "@payloadcms/db-vercel-postgres/drizzle"
import { unstable_cache } from "next/cache"
import type { BasePayload } from "payload"
import { point_balances } from "@/payload-drizzle-schema"

/** Maximum percentage of total campaign points a single user can receive. */
const CAP_PERCENTAGE = 0.05

/** Minimum cap value so early claimers aren't unfairly limited. */
const CAP_MINIMUM = 100

/** Campaigns with fewer total points than this threshold are not capped. */
const CAP_DISABLED_THRESHOLD = 1000

/** Cache TTL for total campaign points (seconds). */
const CACHE_REVALIDATE_SECONDS = 60

/**
 * Fetches the total points distributed in a campaign using a DB aggregate.
 * Results are cached for 60 seconds via Vercel's data cache.
 */
export async function getCampaignTotalPoints(payload: BasePayload, campaignId: number): Promise<number> {
	const cached = unstable_cache(
		async () => {
			const result = await payload.db.drizzle
				.select({
					totalPoints: sum(point_balances.totalPoints),
				})
				.from(point_balances)
				.where(eq(point_balances.campaign, campaignId))

			return Number(result[0]?.totalPoints ?? 0)
		},
		[`campaign-total-points-${campaignId}`],
		{ revalidate: CACHE_REVALIDATE_SECONDS },
	)

	return cached()
}

/**
 * Applies the points cap: a user's signed points are limited to
 * max(CAP_MINIMUM, CAP_PERCENTAGE * totalCampaignPoints).
 *
 * If the user's actual points are below the cap, they're returned as-is.
 * Points of 0 or negative are never capped upward.
 * Campaigns with fewer than 1000 total points are not capped.
 */
export function applyPointsCap(
	userPoints: number,
	totalCampaignPoints: number,
): { points: number; uncappedPoints: number } {
	if (userPoints <= 0 || totalCampaignPoints < CAP_DISABLED_THRESHOLD) {
		return { points: userPoints, uncappedPoints: userPoints }
	}

	const cap = Math.max(CAP_MINIMUM, Math.floor(totalCampaignPoints * CAP_PERCENTAGE))
	return { points: Math.min(userPoints, cap), uncappedPoints: userPoints }
}
