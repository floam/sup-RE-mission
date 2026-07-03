import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { ProxyAgent, setGlobalDispatcher } from "undici"
import { describe, expect, test } from "vitest"

const execFileAsync = promisify(execFile)
const s6GardensCampaignId = "607"
const cmsBaseUrl = "https://cms.superfluid.pro"
const defaultBaseRpcUrl = "https://rpc-endpoints.superfluid.dev/base-mainnet"

const proxyUrl = process.env.HTTPS_PROXY ?? process.env.https_proxy ?? process.env.HTTP_PROXY ?? process.env.http_proxy
if (proxyUrl) setGlobalDispatcher(new ProxyAgent(proxyUrl))

type AccountsResponse = {
	accounts: Array<{ account: `0x${string}`; totalPoints: number }>
}

async function fetchGardensLeaderboardLeader() {
	const response = await fetch(
		`${cmsBaseUrl}/points/accounts?campaignId=${s6GardensCampaignId}&limit=1&page=1&sortBy=points&sortOrder=desc`,
	)
	expect(response.ok).toBe(true)
	const body = (await response.json()) as AccountsResponse
	expect(body.accounts).toHaveLength(1)
	return body.accounts[0]
}

describe("investigate:sup-nonces live smoke test", () => {
	test("runs against the #1 S6 Gardens leaderboard account", { timeout: 120_000 }, async () => {
		const leader = await fetchGardensLeaderboardLeader()

		const { stdout } = await execFileAsync(
			"node",
			[
				"scripts/investigate-sup-nonces.js",
				"--rpc-url",
				process.env.BASE_RPC_URL ?? process.env.RPC_URL ?? defaultBaseRpcUrl,
				"--user",
				leader.account,
				"--program-ids",
				s6GardensCampaignId,
				"--lookback-days",
				"3",
				"--min-age-hours",
				"48",
				"--chunk-size",
				"10000",
				"--json",
			],
			{ cwd: new URL("..", import.meta.url), maxBuffer: 1024 * 1024 * 10 },
		)

		const output = JSON.parse(stdout)
		expect(output.user.toLowerCase()).toBe(leader.account.toLowerCase())
		expect(output.targetProgramIds).toEqual([s6GardensCampaignId])
		expect(output.minimumAgeHours).toBe(48)
		expect(output.lockerCreated).toBeTypeOf("boolean")
		expect(output.matches).toEqual(expect.any(Array))
		if (output.lockerCreated) {
			expect(output.logsScanned).toBeTypeOf("number")
			expect(output.claimTransactionsScanned).toBeTypeOf("number")
		}
	})
})
