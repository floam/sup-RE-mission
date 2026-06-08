import superfluidMetadata from "@superfluid-finance/metadata"
import { describe, expect, test } from "vitest"
import { clearMacroForwarderAbi, clearMacroForwarderAddress } from "../src/abi"

describe("Clear Macro Forwarder", () => {
	test("ABI exposes the clear-signing functions and events", () => {
		const functionNames = clearMacroForwarderAbi.filter((item) => item.type === "function").map((item) => item.name)

		expect(functionNames).toContain("runMacro")
		expect(functionNames).toContain("runPermit2AndMacro")

		// Unlike the blind forwarder, the clear forwarder emits events (e.g. MacroExecuted).
		const eventNames = clearMacroForwarderAbi.filter((item) => item.type === "event").map((item) => item.name)
		expect(eventNames).toContain("MacroExecuted")
	})

	test("address map covers every network that defines clearMacroForwarderV1WithPermit2 in metadata", () => {
		const metadataEntries = superfluidMetadata.networks
			.filter((network) => network.contractsV1.clearMacroForwarderV1WithPermit2)
			.map((network) => [network.chainId, network.contractsV1.clearMacroForwarderV1WithPermit2] as const)

		expect(metadataEntries.length).toBeGreaterThan(0)

		for (const [chainId, address] of metadataEntries) {
			expect(clearMacroForwarderAddress[chainId as keyof typeof clearMacroForwarderAddress]).toBe(address)
		}
	})
})
