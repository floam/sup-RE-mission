import { schedules, task, tasks } from "@trigger.dev/sdk"
import { getPayloadInstance } from "@/payload"
import { PUSH_REQUEST_STATUS } from "../types"
import type { processPushRequest } from "./process-push-request"

const MIN_AGE_MINUTES = 15
const DEFAULT_MAX_AGE_HOURS = 2
const MAX_AGE_HOURS_CAP = 168 // 7 days

function clampMaxAgeHours(input: number | undefined): number {
	if (input === undefined || !Number.isFinite(input) || input <= 0) return DEFAULT_MAX_AGE_HOURS
	return Math.min(input, MAX_AGE_HOURS_CAP)
}

async function runRetryStaleRequests({ maxAgeHours }: { maxAgeHours: number }) {
	console.log(`Checking for stale push requests (maxAgeHours=${maxAgeHours})...`)

	const db = await getPayloadInstance()
	const now = new Date()
	const minAgeCutoff = new Date(now.getTime() - MIN_AGE_MINUTES * 60 * 1000)
	const maxAgeCutoff = new Date(now.getTime() - maxAgeHours * 60 * 60 * 1000)

	const staleRequests = await db.find({
		collection: "push-requests",
		where: {
			and: [
				{ status: { not_equals: PUSH_REQUEST_STATUS.COMPLETED } },
				{ createdAt: { less_than: minAgeCutoff.toISOString() } },
				{ createdAt: { greater_than: maxAgeCutoff.toISOString() } },
			],
		},
		limit: 100,
		depth: 0,
	})

	if (staleRequests.docs.length === 0) {
		console.log("No stale push requests found")
		return { retriggered: 0, total: 0, maxAgeHours }
	}

	console.log(`Found ${staleRequests.docs.length} stale push requests`)

	let retriggeredCount = 0
	for (const request of staleRequests.docs) {
		try {
			await tasks.trigger<typeof processPushRequest>("process-push-request", {
				pushRequestId: request.id,
			})
			retriggeredCount++
			console.log(`Retriggered push request ${request.id}`)
		} catch (error) {
			console.error(`Failed to retrigger push request ${request.id}:`, error)
		}
	}

	console.log(`Retriggered ${retriggeredCount} stale push requests`)
	return { retriggered: retriggeredCount, total: staleRequests.docs.length, maxAgeHours }
}

/**
 * CRON job to retry stale push requests.
 * Runs once per hour.
 * Finds push requests that:
 * - Are NOT completed
 * - Were created more than 15 minutes ago
 * - Were created less than 2 hours ago
 */
export const retryStaleRequests = schedules.task({
	id: "retry-stale-push-requests",
	cron: "0 * * * *", // Once per hour at minute 0
	retry: {
		maxAttempts: 3,
	},
	run: async () => runRetryStaleRequests({ maxAgeHours: DEFAULT_MAX_AGE_HOURS }),
})

/**
 * Manually-invocable version of the retry job.
 * Accepts an optional `maxAgeHours` to widen the lookback beyond the default 2h,
 * clamped to 168h (7 days). The 15-minute minimum age is not configurable.
 */
export const retryStaleRequestsManual = task({
	id: "retry-stale-push-requests-manual",
	retry: {
		maxAttempts: 3,
	},
	run: async (payload: { maxAgeHours?: number } = {}) =>
		runRetryStaleRequests({ maxAgeHours: clampMaxAgeHours(payload.maxAgeHours) }),
})
