#!/usr/bin/env node
import {
	createPublicClient,
	decodeEventLog,
	decodeFunctionData,
	formatUnits,
	getAddress,
	http,
	parseAbiItem,
} from "viem"
import { base } from "viem/chains"

const baseProgramManagerAddress = "0x1e32cf099992E9D3b17eDdDFFfeb2D07AED95C6a"
const baseLockerFactoryAddress = "0xA6694cAB43713287F7735dADc940b555db9d39D9"
const secondsPerHour = 60 * 60
const defaultMinimumAgeHours = 48
const defaultLookbackDays = 30
const defaultLogChunkSize = 50_000n
const claimFunctionNames = new Set(["claim", "claimAndStake", "disconnectAndClaim", "disconnectAndClaimAndStake"])

const lockerFactoryAbi = [
	{
		type: "function",
		name: "getUserLocker",
		stateMutability: "view",
		inputs: [{ name: "user", type: "address" }],
		outputs: [
			{ name: "isCreated", type: "bool" },
			{ name: "lockerAddress", type: "address" },
		],
	},
]

const programManagerAbi = [
	{
		type: "function",
		name: "getNextValidNonce",
		stateMutability: "view",
		inputs: [
			{ name: "programId", type: "uint256" },
			{ name: "user", type: "address" },
		],
		outputs: [{ name: "validNonce", type: "uint256" }],
	},
]

const lockerAbi = [
	{
		type: "function",
		name: "claim",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "programId", type: "uint256" },
			{ name: "totalProgramUnits", type: "uint256" },
			{ name: "nonce", type: "uint256" },
			{ name: "stackSignature", type: "bytes" },
		],
		outputs: [],
	},
	{
		type: "function",
		name: "claim",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "programIds", type: "uint256[]" },
			{ name: "totalProgramUnits", type: "uint256[]" },
			{ name: "nonce", type: "uint256" },
			{ name: "stackSignature", type: "bytes" },
		],
		outputs: [],
	},
	{
		type: "function",
		name: "claimAndStake",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "programId", type: "uint256" },
			{ name: "totalProgramUnits", type: "uint256" },
			{ name: "nonce", type: "uint256" },
			{ name: "stackSignature", type: "bytes" },
		],
		outputs: [],
	},
	{
		type: "function",
		name: "claimAndStake",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "programIds", type: "uint256[]" },
			{ name: "totalProgramUnits", type: "uint256[]" },
			{ name: "nonce", type: "uint256" },
			{ name: "stackSignature", type: "bytes" },
		],
		outputs: [],
	},
	{
		type: "function",
		name: "disconnectAndClaim",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "programIdsToDisconnect", type: "uint256[]" },
			{ name: "programIdsToClaim", type: "uint256[]" },
			{ name: "totalProgramUnits", type: "uint256[]" },
			{ name: "nonce", type: "uint256" },
			{ name: "stackSignature", type: "bytes" },
		],
		outputs: [],
	},
	{
		type: "function",
		name: "disconnectAndClaimAndStake",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "programIdsToDisconnect", type: "uint256[]" },
			{ name: "programIdsToClaim", type: "uint256[]" },
			{ name: "totalProgramUnits", type: "uint256[]" },
			{ name: "nonce", type: "uint256" },
			{ name: "stackSignature", type: "bytes" },
		],
		outputs: [],
	},
]

const claimEventAbi = [
	parseAbiItem("event FluidStreamClaimed(uint256 indexed programId, uint256 indexed totalProgramUnits)"),
	parseAbiItem("event FluidStreamsClaimed(uint256[] indexed programId, uint256[] indexed totalProgramUnits)"),
]

function usage() {
	return `Usage: pnpm --dir sdk/package investigate:sup-nonces --user <address> --program-ids <ids> [options]

Find successful SUP FluidLocker claim transactions whose calldata nonce is older than the configured age threshold.

Required:
  --user <address>               Locker owner address.
  --program-ids <ids>            Comma-separated program IDs, e.g. 7856,7859.

Options:
  --rpc-url <url>                Base RPC URL. Defaults to BASE_RPC_URL, RPC_URL, or https://mainnet.base.org.
  --from-block <number>          First block to scan. Defaults to latest minus --lookback-days.
  --to-block <number|latest>     Last block to scan. Defaults to latest.
  --lookback-days <days>         Used when --from-block is omitted. Default: ${defaultLookbackDays}.
  --min-age-hours <hours>        Only report transactions older than this. Default: ${defaultMinimumAgeHours}.
  --chunk-size <blocks>          eth_getLogs chunk size. Default: ${defaultLogChunkSize}.
  --json                         Emit machine-readable JSON only.
  --help                         Show this help.

Notes:
  - Claim events do not include the nonce, so this script discovers claim logs and decodes transaction input.
  - Batched claim functions use one nonce for all claimed program IDs in the transaction.
`
}

function parseArgs(argv) {
	const options = { json: false }
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i]
		if (arg === "--help" || arg === "-h") options.help = true
		else if (arg === "--json") options.json = true
		else if (arg.startsWith("--")) {
			const key = arg.slice(2)
			const value = argv[i + 1]
			if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`)
			options[key] = value
			i += 1
		} else throw new Error(`Unknown argument: ${arg}`)
	}
	return options
}

function parseProgramIds(value) {
	if (!value) throw new Error("--program-ids is required")
	const ids = value
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean)
		.map((id) => BigInt(id))
	if (ids.length === 0) throw new Error("--program-ids must contain at least one ID")
	return ids
}

function bigintArray(value) {
	return Array.isArray(value) ? value.map((item) => BigInt(item)) : [BigInt(value)]
}

function extractClaimArgs(parsed) {
	const args = parsed.args
	if (!Array.isArray(args)) return null
	if (parsed.functionName === "claim" || parsed.functionName === "claimAndStake") {
		return {
			programIds: bigintArray(args[0]),
			totalProgramUnits: bigintArray(args[1]),
			nonce: BigInt(args[2]),
		}
	}
	if (parsed.functionName === "disconnectAndClaim" || parsed.functionName === "disconnectAndClaimAndStake") {
		return {
			programIds: bigintArray(args[1]),
			totalProgramUnits: bigintArray(args[2]),
			nonce: BigInt(args[3]),
			disconnectedProgramIds: bigintArray(args[0]),
		}
	}
	return null
}

function toJson(value) {
	return JSON.stringify(
		value,
		(_key, currentValue) => (typeof currentValue === "bigint" ? currentValue.toString() : currentValue),
		2,
	)
}

async function getBlockTimestamp(client, blockNumber, cache) {
	const key = blockNumber.toString()
	const cached = cache.get(key)
	if (cached) return cached
	const block = await client.getBlock({ blockNumber })
	cache.set(key, block.timestamp)
	return block.timestamp
}

async function getLogsChunked(client, { address, fromBlock, toBlock, chunkSize }) {
	const logs = []
	let cursor = fromBlock
	while (cursor <= toBlock) {
		const chunkToBlock = cursor + chunkSize - 1n > toBlock ? toBlock : cursor + chunkSize - 1n
		const chunkLogs = await client.getLogs({ address, events: claimEventAbi, fromBlock: cursor, toBlock: chunkToBlock })
		logs.push(...chunkLogs)
		cursor = chunkToBlock + 1n
	}
	return logs
}

function collectClaimTransactionsFromLogs(logs) {
	const programsByTransaction = new Map()
	for (const log of logs) {
		const key = log.transactionHash
		const existing = programsByTransaction.get(key) ?? new Set()
		try {
			const decoded = decodeEventLog({ abi: claimEventAbi, data: log.data, topics: log.topics })
			const eventProgramIds = bigintArray(decoded.args.programId)
			for (const programId of eventProgramIds) existing.add(programId.toString())
		} catch {
			// Indexed array event values are stored as topic hashes and cannot reveal program IDs.
			// Keep the transaction hash anyway; calldata decoding below is the authoritative source.
		}
		programsByTransaction.set(key, existing)
	}
	return programsByTransaction
}

async function main() {
	const options = parseArgs(process.argv.slice(2))
	if (options.help) {
		console.log(usage())
		return
	}

	const user = options.user ? getAddress(options.user) : undefined
	if (!user) throw new Error("--user is required")
	const programIds = parseProgramIds(options["program-ids"])
	const targetProgramIds = new Set(programIds.map((id) => id.toString()))
	const rpcUrl = options["rpc-url"] ?? process.env.BASE_RPC_URL ?? process.env.RPC_URL ?? "https://mainnet.base.org"
	const minimumAgeSeconds = BigInt(Number(options["min-age-hours"] ?? defaultMinimumAgeHours) * secondsPerHour)
	const lookbackDays = Number(options["lookback-days"] ?? defaultLookbackDays)
	const chunkSize = BigInt(options["chunk-size"] ?? defaultLogChunkSize)

	const client = createPublicClient({ chain: base, transport: http(rpcUrl) })
	const latestBlockNumber = await client.getBlockNumber()
	const latestBlock = await client.getBlock({ blockNumber: latestBlockNumber })
	const toBlock =
		options["to-block"] && options["to-block"] !== "latest" ? BigInt(options["to-block"]) : latestBlockNumber
	const estimatedBaseBlocksPerDay = BigInt(Math.ceil((24 * secondsPerHour) / 2))
	const fromBlock = options["from-block"]
		? BigInt(options["from-block"])
		: latestBlockNumber > estimatedBaseBlocksPerDay * BigInt(lookbackDays)
			? latestBlockNumber - estimatedBaseBlocksPerDay * BigInt(lookbackDays)
			: 0n

	const [isCreated, lockerAddress] = await client.readContract({
		address: baseLockerFactoryAddress,
		abi: lockerFactoryAbi,
		functionName: "getUserLocker",
		args: [user],
	})

	const currentNonces = {}
	for (const programId of programIds) {
		currentNonces[programId.toString()] = await client.readContract({
			address: baseProgramManagerAddress,
			abi: programManagerAbi,
			functionName: "getNextValidNonce",
			args: [programId, user],
		})
	}

	const summary = {
		chainId: base.id,
		user,
		lockerAddress,
		lockerCreated: isCreated,
		programManagerAddress: baseProgramManagerAddress,
		lockerFactoryAddress: baseLockerFactoryAddress,
		targetProgramIds: programIds,
		currentNonces,
		fromBlock,
		toBlock,
		latestBlockNumber,
		latestBlockTimestamp: latestBlock.timestamp,
		minimumAgeHours: Number(options["min-age-hours"] ?? defaultMinimumAgeHours),
	}

	if (!isCreated) {
		const output = { ...summary, matches: [] }
		console.log(toJson(output))
		return
	}

	const logs = await getLogsChunked(client, { address: lockerAddress, fromBlock, toBlock, chunkSize })
	const programsByTransaction = collectClaimTransactionsFromLogs(logs)
	const blockTimestampCache = new Map([[latestBlockNumber.toString(), latestBlock.timestamp]])
	const matches = []

	for (const [transactionHash, eventProgramIds] of programsByTransaction.entries()) {
		const transaction = await client.getTransaction({ hash: transactionHash })
		if (transaction.to?.toLowerCase() !== lockerAddress.toLowerCase()) continue

		let parsed
		try {
			parsed = decodeFunctionData({ abi: lockerAbi, data: transaction.input })
		} catch {
			continue
		}
		if (!claimFunctionNames.has(parsed.functionName)) continue
		const claimArgs = extractClaimArgs(parsed)
		if (!claimArgs) continue
		const claimedTargetProgramIds = claimArgs.programIds.filter((programId) =>
			targetProgramIds.has(programId.toString()),
		)
		if (claimedTargetProgramIds.length === 0) continue

		const blockTimestamp = await getBlockTimestamp(client, transaction.blockNumber, blockTimestampCache)
		const ageSeconds = latestBlock.timestamp - blockTimestamp
		if (ageSeconds < minimumAgeSeconds) continue

		matches.push({
			transactionHash,
			blockNumber: transaction.blockNumber,
			blockTimestamp,
			ageHours: Number(formatUnits(ageSeconds, 0)) / secondsPerHour,
			functionName: parsed.functionName,
			programIds: claimArgs.programIds,
			claimedTargetProgramIds,
			eventProgramIds: [...eventProgramIds],
			totalProgramUnits: claimArgs.totalProgramUnits,
			disconnectedProgramIds: claimArgs.disconnectedProgramIds,
			calldataNonce: claimArgs.nonce,
		})
	}

	matches.sort((a, b) => Number(a.blockNumber - b.blockNumber))
	const output = { ...summary, logsScanned: logs.length, claimTransactionsScanned: programsByTransaction.size, matches }

	if (options.json) {
		console.log(toJson(output))
		return
	}

	console.log(`SUP nonce investigation on Base for ${user}`)
	console.log(`Locker: ${lockerAddress} (${isCreated ? "created" : "not created"})`)
	console.log(
		`Scanned blocks ${fromBlock}..${toBlock}; ${logs.length} claim logs; ${matches.length} matches older than ${output.minimumAgeHours}h.`,
	)
	console.log("Current on-chain nonces:")
	for (const [programId, nonce] of Object.entries(currentNonces)) console.log(`  program ${programId}: ${nonce}`)
	if (matches.length === 0) return
	console.log("\nMatches:")
	for (const match of matches) {
		const date = new Date(Number(match.blockTimestamp) * 1000).toISOString()
		console.log(`- ${match.transactionHash}`)
		console.log(`  block: ${match.blockNumber} (${date}, ${match.ageHours.toFixed(2)}h old)`)
		console.log(`  function: ${match.functionName}`)
		console.log(`  calldata nonce: ${match.calldataNonce}`)
		console.log(`  claimed target programs: ${match.claimedTargetProgramIds.join(", ")}`)
		console.log(`  all claimed programs: ${match.programIds.join(", ")}`)
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error)
	process.exitCode = 1
})
