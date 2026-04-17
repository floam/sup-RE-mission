import { schedules, task, tasks } from "@trigger.dev/sdk"
import { getPayloadInstance } from "@/payload"
import { PUSH_REQUEST_STATUS } from "../types"
import type { processPushRequest } from "./process-push-request"

const MIN_AGE_MINUTES = 15
const DEFAULT_MAX_AGE_HOURS = 2
const MAX_AGE_HOURS_CAP = 168 // 7 days
const MAX_TRIGGERS_PER_RUN = 1000 // trigger.dev batchTrigger hard limit

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
		limit: MAX_TRIGGERS_PER_RUN,
		sort: "-createdAt",
		depth: 0,
	})

	const totalFound = staleRequests.totalDocs
	const capped = totalFound > staleRequests.docs.length

	if (staleRequests.docs.length === 0) {
		console.log("No stale push requests found")
		return { retriggered: 0, total: 0, maxAgeHours, capped: false }
	}

	console.log(`Found ${totalFound} stale push requests${capped ? ` (capped at ${MAX_TRIGGERS_PER_RUN})` : ""}`)

	await tasks.batchTrigger<typeof processPushRequest>(
		"process-push-request",
		staleRequests.docs.map((r) => ({ payload: { pushRequestId: r.id } })),
	)

	console.log(`Retriggered ${staleRequests.docs.length} stale push requests`)
	return { retriggered: staleRequests.docs.length, total: totalFound, maxAgeHours, capped }
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
