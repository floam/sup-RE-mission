import superfluidMetadata from "@superfluid-finance/metadata"
import { BaseError, ContractFunctionRevertedError, createPublicClient, maxUint256, parseEther, stringToHex } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { optimismSepolia } from "viem/chains"
import { describe, expect, test } from "vitest"
import { clearMacroForwarderAbi, clearMacroForwarderAddress } from "../src/abi"
import { superfluidTestnetTransports } from "../src/config"

// A "Dashboard" Clear Macro deployed on Optimism Sepolia that implements IClearMacro and
// exposes typed encoders (encodeApprove / encodeTransfer / ...) for building action params.
const CLEAR_MACRO_ADDRESS = "0x77232a2a953b570D1fEE1FE16b1902299fe7b898" as const
const clearMacroAbi = [
	{
		inputs: [
			{ name: "lang", type: "bytes32" },
			{
				components: [
					{ name: "superToken", type: "address" },
					{ name: "spender", type: "address" },
					{ name: "amount", type: "uint256" },
				],
				name: "p",
				type: "tuple",
			},
		],
		name: "encodeApprove",
		outputs: [{ name: "actionParams", type: "bytes" }],
		stateMutability: "pure",
		type: "function",
	},
	{
		inputs: [
			{ name: "lang", type: "bytes32" },
			{
				components: [
					{ name: "superToken", type: "address" },
					{ name: "receiver", type: "address" },
					{ name: "amount", type: "uint256" },
				],
				name: "p",
				type: "tuple",
			},
		],
		name: "encodeTransfer",
		outputs: [{ name: "actionParams", type: "bytes" }],
		stateMutability: "pure",
		type: "function",
	},
] as const

const chain = optimismSepolia
const LANG = stringToHex("en", { size: 32 })
const VITALIK = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as const

type Client = ReturnType<typeof createPublicClient>
type ActionBuilder = (ctx: {
	client: Client
	superToken: `0x${string}`
	signer: `0x${string}`
}) => Promise<`0x${string}`>

/** Encode an "approve 1 wei" action (needs no balance). */
const approveAction: ActionBuilder = ({ client, superToken, signer }) =>
	client.readContract({
		address: CLEAR_MACRO_ADDRESS,
		abi: clearMacroAbi,
		functionName: "encodeApprove",
		args: [LANG, { superToken, spender: signer, amount: 1n }],
	})

/** Encode a transfer action of `amount` (needs the signer to hold that balance). */
const transferAction =
	(amount: bigint): ActionBuilder =>
	({ client, superToken }) =>
		client.readContract({
			address: CLEAR_MACRO_ADDRESS,
			abi: clearMacroAbi,
			functionName: "encodeTransfer",
			args: [LANG, { superToken, receiver: VITALIK, amount }],
		})

/**
 * Builds a clear-signed macro payload against the live forwarder + macro:
 * <action> -> encodeParams -> getDigest. Returns everything needed to sign and
 * simulate `runMacro`. Uses a fresh EOA so the signer never has contract code
 * (otherwise the on-chain SignatureChecker takes the ERC-1271 path instead of ecrecover).
 */
async function prepareMacro(buildActionParams: ActionBuilder) {
	const forwarder = clearMacroForwarderAddress[chain.id]
	const superToken = superfluidMetadata.getNetworkByChainId(chain.id)?.nativeTokenWrapper as `0x${string}`

	expect(forwarder, "clearMacroForwarder address missing for chain").toBeDefined()
	expect(superToken, "nativeTokenWrapper missing in metadata for chain").toBeDefined()

	const account = privateKeyToAccount(generatePrivateKey())
	const signer = account.address
	const client = createPublicClient({ chain, transport: superfluidTestnetTransports[chain.id] })

	const actionParams = await buildActionParams({ client, superToken, signer })

	const [, domainName] = await client.readContract({
		address: forwarder,
		abi: clearMacroForwarderAbi,
		functionName: "eip712Domain",
	})
	const provider = await client.readContract({
		address: forwarder,
		abi: clearMacroForwarderAbi,
		functionName: "SELF_PROVIDER",
	})
	const nonce = await client.readContract({
		address: forwarder,
		abi: clearMacroForwarderAbi,
		functionName: "getNonce",
		args: [signer, 0n],
	})

	const encodedPayload = await client.readContract({
		address: forwarder,
		abi: clearMacroForwarderAbi,
		functionName: "encodeParams",
		args: [
			actionParams,
			{
				domain: domainName,
				macroContract: CLEAR_MACRO_ADDRESS,
				provider,
				validAfter: 0n,
				validBefore: maxUint256,
				nonce,
			},
		],
	})
	const digest = await client.readContract({
		address: forwarder,
		abi: clearMacroForwarderAbi,
		functionName: "getDigest",
		args: [CLEAR_MACRO_ADDRESS, encodedPayload],
	})

	return { client, forwarder, account, signer, encodedPayload, digest }
}

/** Run `runMacro` as a simulation and return the decoded revert error (or null if it succeeds). */
async function runMacroExpectingRevert(
	client: Client,
	forwarder: `0x${string}`,
	signer: `0x${string}`,
	encodedPayload: `0x${string}`,
	signature: `0x${string}`,
) {
	const error = await client
		.simulateContract({
			address: forwarder,
			abi: clearMacroForwarderAbi,
			functionName: "runMacro",
			args: [CLEAR_MACRO_ADDRESS, encodedPayload, signer, signature],
			account: signer,
		})
		.then(
			() => null,
			(e) => e as BaseError,
		)
	expect(error, "expected runMacro to revert").toBeInstanceOf(BaseError)
	return error?.walk((e) => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null
}

describe("Clear Macro Forwarder simulation", () => {
	test("simulates a clear-signed approve macro on Optimism Sepolia", { timeout: 30_000 }, async () => {
		const { client, forwarder, account, signer, encodedPayload, digest } = await prepareMacro(approveAction)

		// Sign the digest and simulate the relayed macro execution (no broadcast).
		// Provider "self" requires the executor to equal the signer.
		const signature = await account.sign({ hash: digest })
		const { result } = await client.simulateContract({
			address: forwarder,
			abi: clearMacroForwarderAbi,
			functionName: "runMacro",
			args: [CLEAR_MACRO_ADDRESS, encodedPayload, signer, signature],
			account: signer,
		})

		expect(result).toBe(true)
	})

	test("reverts with InvalidSignature when the signature is from the wrong signer", { timeout: 30_000 }, async () => {
		const { client, forwarder, signer, encodedPayload, digest } = await prepareMacro(approveAction)

		// Sign the (valid) digest with a different key than the declared `signer`.
		const wrongAccount = privateKeyToAccount(generatePrivateKey())
		const wrongSignature = await wrongAccount.sign({ hash: digest })

		const revert = await runMacroExpectingRevert(client, forwarder, signer, encodedPayload, wrongSignature)
		expect(revert?.data?.errorName).toBe("InvalidSignature")
	})

	test("decodes the Super Token domain error on insufficient balance", { timeout: 30_000 }, async () => {
		// Transfer 1 token from a freshly generated (zero-balance) signer.
		const { client, forwarder, account, signer, encodedPayload, digest } = await prepareMacro(
			transferAction(parseEther("1")),
		)

		const signature = await account.sign({ hash: digest })

		// The error originates in the Super Token, not the forwarder. It only decodes because the
		// SDK's `clearMacroForwarderAbi` is augmented with the protocol error codes (allErrors).
		const revert = await runMacroExpectingRevert(client, forwarder, signer, encodedPayload, signature)
		expect(revert?.data?.errorName).toBe("SF_TOKEN_MOVE_INSUFFICIENT_BALANCE")
	})
})
