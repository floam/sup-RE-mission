import superfluidMetadata from "@superfluid-finance/metadata"
import { describe, expect, test } from "vitest"
import { blindMacroForwarderAbi, blindMacroForwarderAddress } from "../src/abi"

describe("Blind Macro Forwarder", () => {
	test("ABI exposes the expected functions and events", () => {
		const functionNames = blindMacroForwarderAbi.filter((item) => item.type === "function").map((item) => item.name)

		expect(functionNames).toContain("buildBatchOperations")
		expect(functionNames).toContain("runMacro")

		const eventNames = blindMacroForwarderAbi.filter((item) => item.type === "event").map((item) => item.name)
		expect(eventNames).toContain("MacroExecuted")
	})

	test("address map covers every network that defines macroForwarder in metadata", () => {
		const metadataEntries = superfluidMetadata.networks
			.filter((network) => network.contractsV1.macroForwarder)
			.map((network) => [network.chainId, network.contractsV1.macroForwarder] as const)

		expect(metadataEntries.length).toBeGreaterThan(0)

		for (const [chainId, address] of metadataEntries) {
			expect(blindMacroForwarderAddress[chainId as keyof typeof blindMacroForwarderAddress]).toBe(address)
		}
	})
})
