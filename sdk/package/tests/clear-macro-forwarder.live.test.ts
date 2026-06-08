import superfluidMetadata from "@superfluid-finance/metadata"
import { createPublicClient, maxUint256, stringToHex } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { optimismSepolia } from "viem/chains"
import { describe, expect, test } from "vitest"
import { clearMacroForwarderAbi, clearMacroForwarderAddress } from "../src/abi"
import { superfluidTestnetTransports } from "../src/config"

// A "Dashboard" Clear Macro deployed on Optimism Sepolia that implements IClearMacro and
// exposes typed encoders (encodeApprove, etc.) for building action params.
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
] as const

describe("Clear Macro Forwarder simulation", () => {
	test("simulates a clear-signed approve macro on Optimism Sepolia", { timeout: 30_000 }, async () => {
		const chain = optimismSepolia
		const forwarder = clearMacroForwarderAddress[chain.id]
		const superToken = superfluidMetadata.getNetworkByChainId(chain.id)?.nativeTokenWrapper as `0x${string}`

		expect(forwarder, "clearMacroForwarder address missing for chain").toBeDefined()
		expect(superToken, "nativeTokenWrapper missing in metadata for chain").toBeDefined()

		// Fresh EOA so the signer never has contract code (otherwise the on-chain
		// SignatureChecker would take the ERC-1271 path instead of ecrecover).
		const account = privateKeyToAccount(generatePrivateKey())
		const signer = account.address

		const client = createPublicClient({ chain, transport: superfluidTestnetTransports[chain.id] })

		// 1. Build the macro's action params (approve 1 wei of the native Super Token).
		const actionParams = await client.readContract({
			address: CLEAR_MACRO_ADDRESS,
			abi: clearMacroAbi,
			functionName: "encodeApprove",
			args: [stringToHex("en", { size: 32 }), { superToken, spender: signer, amount: 1n }],
		})

		// 2. Read the forwarder's EIP-712 domain, self-relay provider, and the signer's nonce.
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

		// 3. Encode the full payload (action + security) and get the EIP-712 digest to sign.
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

		// 4. Sign the digest and simulate the relayed macro execution (no broadcast).
		//    Provider "self" requires the executor to equal the signer.
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
})
