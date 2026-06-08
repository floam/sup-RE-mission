import {
	createPublicClient,
	encodeAbiParameters,
	encodeFunctionData,
	keccak256,
	pad,
	parseAbiParameters,
	parseEther,
	toHex,
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { optimismSepolia } from "viem/chains"
import { describe, expect, test } from "vitest"
import { superTokenAbi } from "../src/abi"
import {
	legacyVestingSchedulerV2Abi,
	legacyVestingSchedulerV2Address,
	vestingSchedulerV3Abi,
	vestingSchedulerV3Address,
} from "../src/abi/automation"
import { cfaAbi, cfaAddress, hostAbi, hostAddress } from "../src/abi/core"
import { superfluidTestnetTransports } from "../src/config"
import { OPERATION_TYPE, type Operation, prepareOperation, stripFunctionSelector } from "../src/constant"

// Storage slots of the OP Sepolia USDCx Super Token and its underlying test token,
// discovered empirically (override a candidate slot, read back the getter). Used to
// fund a throwaway account via `stateOverride` so simulations need no real balances
// and no PRIVATE_KEY / funded test account.
const USDCX_BALANCE_SLOT = 2n
const UNDERLYING_BALANCE_SLOT = 0n
const UNDERLYING_ALLOWANCE_SLOT = 1n

const wrapperSuperTokenAddress = "0x131780640edf9830099aac2203229073d6d2fe69" as const // USDCx
const vitalikAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as const

// Amount the throwaway account is funded with via state override (plenty for the 1-wei ops + flow buffer).
const FUNDED_AMOUNT = parseEther("1000000")

/** keccak256(abi.encode(key, slot)) — storage slot of `mapping(address => uint256)[key]`. */
function mappingSlot(key: `0x${string}`, slot: bigint) {
	return keccak256(encodeAbiParameters(parseAbiParameters("address, uint256"), [key, slot]))
}

/** Storage slot of `mapping(address => mapping(address => uint256))[owner][spender]`. */
function nestedMappingSlot(owner: `0x${string}`, spender: `0x${string}`, slot: bigint) {
	const inner = keccak256(encodeAbiParameters(parseAbiParameters("address, uint256"), [owner, slot]))
	return keccak256(encodeAbiParameters(parseAbiParameters("address, bytes32"), [spender, inner]))
}

/**
 * Funds `account` for the batch call by overriding state (no broadcast, no real balances):
 * native ETH for the payable op, USDCx balance, and underlying balance + allowance for the upgrade.
 */
function fundingStateOverride(account: `0x${string}`, underlying: `0x${string}`) {
	const big = pad(toHex(FUNDED_AMOUNT))
	return [
		{ address: account, balance: parseEther("1") },
		{
			address: wrapperSuperTokenAddress,
			stateDiff: [{ slot: mappingSlot(account, USDCX_BALANCE_SLOT), value: big }],
		},
		{
			address: underlying,
			stateDiff: [
				{ slot: mappingSlot(account, UNDERLYING_BALANCE_SLOT), value: big },
				{ slot: nestedMappingSlot(account, wrapperSuperTokenAddress, UNDERLYING_ALLOWANCE_SLOT), value: big },
			],
		},
	] as const
}

/**
 * Preflight: confirm the override actually lands on the right storage slots, so a storage-layout
 * change in USDCx / the underlying surfaces as a clear failure here rather than an opaque revert
 * deep inside `batchCall`.
 */
async function assertFunded(
	client: ReturnType<typeof createPublicClient>,
	account: `0x${string}`,
	underlying: `0x${string}`,
	stateOverride: ReturnType<typeof fundingStateOverride>,
) {
	const [superTokenBalance, underlyingAllowance] = await Promise.all([
		client.readContract({
			address: wrapperSuperTokenAddress,
			abi: superTokenAbi,
			functionName: "balanceOf",
			args: [account],
			stateOverride,
		}),
		client.readContract({
			address: underlying,
			abi: superTokenAbi,
			functionName: "allowance",
			args: [account, wrapperSuperTokenAddress],
			stateOverride,
		}),
	])
	expect(superTokenBalance, "USDCx balance override did not apply (slot drift?)").toBe(FUNDED_AMOUNT)
	expect(underlyingAllowance, "underlying allowance override did not apply (slot drift?)").toBe(FUNDED_AMOUNT)
}

describe("Superfluid batch call tests", () => {
	test("should be able to simulate a transaction with all the operation types (raw)", async () => {
		const account = privateKeyToAccount(generatePrivateKey())

		const chain = optimismSepolia
		const client = createPublicClient({ chain, transport: superfluidTestnetTransports[chain.id] })

		const underlying = await client.readContract({
			address: wrapperSuperTokenAddress,
			abi: superTokenAbi,
			functionName: "getUnderlyingToken",
		})

		// # ERC20_APPROVE
		const erc20Approve = encodeFunctionData({
			abi: superTokenAbi,
			functionName: "approve",
			args: [vitalikAddress, 1n],
		})

		const erc20ApproveOperation: Operation = {
			operationType: OPERATION_TYPE.ERC20_APPROVE,
			target: wrapperSuperTokenAddress,
			data: stripFunctionSelector(erc20Approve),
		}
		// ---

		// # ERC20_TRANSFER_FROM
		const erc20TransferFrom = encodeFunctionData({
			abi: superTokenAbi,
			functionName: "transferFrom",
			args: [account.address, vitalikAddress, 1n],
		})

		const erc20TransferFromOperation: Operation = {
			operationType: OPERATION_TYPE.ERC20_TRANSFER_FROM,
			target: wrapperSuperTokenAddress,
			data: stripFunctionSelector(erc20TransferFrom),
		}
		// ---

		// # ERC777_SEND
		const erc777Send = encodeFunctionData({
			abi: superTokenAbi,
			functionName: "send",
			args: [vitalikAddress, 1n, "0x"],
		})

		const erc777SendOperation: Operation = {
			operationType: OPERATION_TYPE.ERC777_SEND,
			target: wrapperSuperTokenAddress,
			data: stripFunctionSelector(erc777Send),
		}
		// ---

		// # ERC20_INCREASE_ALLOWANCE
		const erc20IncreaseAllowance = encodeFunctionData({
			abi: superTokenAbi,
			functionName: "increaseAllowance",
			args: [vitalikAddress, 1n],
		})

		const erc20IncreaseAllowanceOperation: Operation = {
			operationType: OPERATION_TYPE.ERC20_INCREASE_ALLOWANCE,
			target: wrapperSuperTokenAddress,
			data: stripFunctionSelector(erc20IncreaseAllowance),
		}
		// ---

		// # ERC20_DECREASE_ALLOWANCE
		const erc20DecreaseAllowance = encodeFunctionData({
			abi: superTokenAbi,
			functionName: "decreaseAllowance",
			args: [vitalikAddress, 1n],
		})

		const erc20DecreaseAllowanceOperation: Operation = {
			operationType: OPERATION_TYPE.ERC20_DECREASE_ALLOWANCE,
			target: wrapperSuperTokenAddress,
			data: stripFunctionSelector(erc20DecreaseAllowance),
		}
		// ---

		// # SUPERTOKEN_UPGRADE
		const superTokenUpgrade = encodeFunctionData({
			abi: superTokenAbi,
			functionName: "upgrade",
			args: [1n],
		})

		const superTokenUpgradeOperation: Operation = {
			operationType: OPERATION_TYPE.SUPERTOKEN_UPGRADE,
			target: wrapperSuperTokenAddress,
			data: stripFunctionSelector(superTokenUpgrade),
		}
		// ---

		// # SUPERTOKEN_DOWNGRADE
		const superTokenDowngrade = encodeFunctionData({
			abi: superTokenAbi,
			functionName: "downgrade",
			args: [1n],
		})

		const superTokenDowngradeOperation: Operation = {
			operationType: OPERATION_TYPE.SUPERTOKEN_DOWNGRADE,
			target: wrapperSuperTokenAddress,
			data: stripFunctionSelector(superTokenDowngrade),
		}
		// ---

		// Note: native asset upgrade(ByEth) & downgrade(ToEth) are not supported.

		// # SUPERFLUID_CALL_AGREEMENT
		const callAgreementCreateFlowInternal = encodeFunctionData({
			abi: cfaAbi,
			functionName: "createFlow",
			args: [wrapperSuperTokenAddress, vitalikAddress, 1n, "0x"],
		})

		const userData = "0x"
		const callAgreementCreateFlow = encodeAbiParameters(parseAbiParameters("bytes, bytes"), [
			callAgreementCreateFlowInternal,
			userData,
		])

		const callAgreementCreateFlowOperation: Operation = {
			operationType: OPERATION_TYPE.SUPERFLUID_CALL_AGREEMENT,
			target: cfaAddress[chain.id],
			data: callAgreementCreateFlow,
		}
		// ---

		// # CALL_APP_ACTION
		const callAppActionCreateVestingSchedule = encodeFunctionData({
			abi: legacyVestingSchedulerV2Abi,
			functionName: "createVestingSchedule",
			args: [wrapperSuperTokenAddress, vitalikAddress, 1893448800, 0, 1n, 0n, 1924984800, "0x"],
		})

		const callAppActionCreateVestingScheduleOperation: Operation = {
			operationType: OPERATION_TYPE.CALL_APP_ACTION,
			target: legacyVestingSchedulerV2Address[chain.id],
			data: callAppActionCreateVestingSchedule,
		}
		// ---

		// # SIMPLE_FORWARD_CALL
		const simpleForwardCallPayableValue = 1n
		const simpleForwardCallOperation: Operation = {
			operationType: OPERATION_TYPE.SIMPLE_FORWARD_CALL,
			target: vitalikAddress,
			data: "0x",
		} as const
		// ---

		// # ERC2771_FORWARD_CALL
		const erc2771ForwardCall = encodeFunctionData({
			abi: vestingSchedulerV3Abi,
			functionName: "createVestingSchedule",
			args: [wrapperSuperTokenAddress, vitalikAddress, 1893448800, 0, 1n, 0n, 1924984800],
		})

		const erc2771ForwardCallOperation: Operation = {
			operationType: OPERATION_TYPE.ERC2771_FORWARD_CALL,
			target: vestingSchedulerV3Address[chain.id],
			data: erc2771ForwardCall,
		}
		// ---

		const stateOverride = fundingStateOverride(account.address, underlying)
		await assertFunded(client, account.address, underlying, stateOverride)

		const operations = [
			simpleForwardCallOperation, // Put payable operation with value transfer first
			erc20ApproveOperation,
			erc20TransferFromOperation,
			erc777SendOperation,
			erc20IncreaseAllowanceOperation,
			erc20DecreaseAllowanceOperation,
			superTokenUpgradeOperation,
			superTokenDowngradeOperation,
			callAgreementCreateFlowOperation,
			callAppActionCreateVestingScheduleOperation,
			erc2771ForwardCallOperation,
		]

		const batchCall = await client.simulateContract({
			account: account.address,
			address: hostAddress[chain.id],
			abi: hostAbi,
			functionName: "batchCall",
			value: simpleForwardCallPayableValue,
			stateOverride,
			args: [operations],
		})

		expect(batchCall.request.args[0]).toHaveLength(operations.length)
		expect(batchCall.request.value).toBe(simpleForwardCallPayableValue)
	})

	test("should be able to simulate a transaction with all the operation types (using helper function)", async () => {
		const account = privateKeyToAccount(generatePrivateKey())

		const chain = optimismSepolia
		const client = createPublicClient({ chain, transport: superfluidTestnetTransports[chain.id] })

		const underlying = await client.readContract({
			address: wrapperSuperTokenAddress,
			abi: superTokenAbi,
			functionName: "getUnderlyingToken",
		})

		// # ERC20_APPROVE
		const erc20ApproveOperation = prepareOperation({
			operationType: OPERATION_TYPE.ERC20_APPROVE,
			target: wrapperSuperTokenAddress,
			data: encodeFunctionData({
				abi: superTokenAbi,
				functionName: "approve",
				args: [vitalikAddress, 1n],
			}),
		})
		// ---

		// # ERC20_TRANSFER_FROM
		const erc20TransferFromOperation = prepareOperation({
			operationType: OPERATION_TYPE.ERC20_TRANSFER_FROM,
			target: wrapperSuperTokenAddress,
			data: encodeFunctionData({
				abi: superTokenAbi,
				functionName: "transferFrom",
				args: [account.address, vitalikAddress, 1n],
			}),
		})
		// ---

		// # ERC777_SEND
		const erc777SendOperation = prepareOperation({
			operationType: OPERATION_TYPE.ERC777_SEND,
			target: wrapperSuperTokenAddress,
			data: encodeFunctionData({
				abi: superTokenAbi,
				functionName: "send",
				args: [vitalikAddress, 1n, "0x"],
			}),
		})
		// ---

		// # ERC20_INCREASE_ALLOWANCE
		const erc20IncreaseAllowanceOperation = prepareOperation({
			operationType: OPERATION_TYPE.ERC20_INCREASE_ALLOWANCE,
			target: wrapperSuperTokenAddress,
			data: encodeFunctionData({
				abi: superTokenAbi,
				functionName: "increaseAllowance",
				args: [vitalikAddress, 1n],
			}),
		})
		// ---

		// # ERC20_DECREASE_ALLOWANCE
		const erc20DecreaseAllowanceOperation = prepareOperation({
			operationType: OPERATION_TYPE.ERC20_DECREASE_ALLOWANCE,
			target: wrapperSuperTokenAddress,
			data: encodeFunctionData({
				abi: superTokenAbi,
				functionName: "decreaseAllowance",
				args: [vitalikAddress, 1n],
			}),
		})
		// ---

		// # SUPERTOKEN_UPGRADE
		const superTokenUpgradeOperation = prepareOperation({
			operationType: OPERATION_TYPE.SUPERTOKEN_UPGRADE,
			target: wrapperSuperTokenAddress,
			data: encodeFunctionData({
				abi: superTokenAbi,
				functionName: "upgrade",
				args: [1n],
			}),
		})
		// ---

		// # SUPERTOKEN_DOWNGRADE
		const superTokenDowngradeOperation = prepareOperation({
			operationType: OPERATION_TYPE.SUPERTOKEN_DOWNGRADE,
			target: wrapperSuperTokenAddress,
			data: encodeFunctionData({
				abi: superTokenAbi,
				functionName: "downgrade",
				args: [1n],
			}),
		})
		// ---

		// Note: native asset upgrade(ByEth) & downgrade(ToEth) are not supported.

		// # SUPERFLUID_CALL_AGREEMENT
		const callAgreementCreateFlowOperation = prepareOperation({
			operationType: OPERATION_TYPE.SUPERFLUID_CALL_AGREEMENT,
			target: cfaAddress[chain.id],
			data: encodeFunctionData({
				abi: cfaAbi,
				functionName: "createFlow",
				args: [wrapperSuperTokenAddress, vitalikAddress, 1n, "0x"],
			}),
			userData: "0x",
		})
		// ---

		// # CALL_APP_ACTION
		const callAppActionCreateVestingScheduleOperation = prepareOperation({
			operationType: OPERATION_TYPE.CALL_APP_ACTION,
			target: legacyVestingSchedulerV2Address[chain.id],
			data: encodeFunctionData({
				abi: legacyVestingSchedulerV2Abi,
				functionName: "createVestingSchedule",
				args: [wrapperSuperTokenAddress, vitalikAddress, 1893448800, 0, 1n, 0n, 1924984800, "0x"],
			}),
		})
		// ---

		// # SIMPLE_FORWARD_CALL
		const simpleForwardCallPayableValue = 1n
		const simpleForwardCallOperation = prepareOperation({
			operationType: OPERATION_TYPE.SIMPLE_FORWARD_CALL,
			target: vitalikAddress,
			data: "0x",
		})
		// ---

		// # ERC2771_FORWARD_CALL
		const erc2771ForwardCallOperation = prepareOperation({
			operationType: OPERATION_TYPE.ERC2771_FORWARD_CALL,
			target: vestingSchedulerV3Address[chain.id],
			data: encodeFunctionData({
				abi: vestingSchedulerV3Abi,
				functionName: "createVestingSchedule",
				args: [wrapperSuperTokenAddress, vitalikAddress, 1893448800, 0, 1n, 0n, 1924984800],
			}),
		})
		// ---

		const stateOverride = fundingStateOverride(account.address, underlying)
		await assertFunded(client, account.address, underlying, stateOverride)

		const operations = [
			simpleForwardCallOperation, // Put payable operation with value transfer first
			erc20ApproveOperation,
			erc20TransferFromOperation,
			erc777SendOperation,
			erc20IncreaseAllowanceOperation,
			erc20DecreaseAllowanceOperation,
			superTokenUpgradeOperation,
			superTokenDowngradeOperation,
			callAgreementCreateFlowOperation,
			callAppActionCreateVestingScheduleOperation,
			erc2771ForwardCallOperation,
		]

		const batchCall = await client.simulateContract({
			account: account.address,
			address: hostAddress[chain.id],
			abi: hostAbi,
			functionName: "batchCall",
			value: simpleForwardCallPayableValue,
			stateOverride,
			args: [operations],
		})

		expect(batchCall.request.args[0]).toHaveLength(operations.length)
		expect(batchCall.request.value).toBe(simpleForwardCallPayableValue)
	})
})
