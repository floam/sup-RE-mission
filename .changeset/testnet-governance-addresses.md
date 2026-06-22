---
"@sfpro/sdk": patch
---

Add governance contract addresses for testnets. Previously the `governance` contract was only configured for mainnets, since `@superfluid-finance/metadata` does not list a governance address for testnets. The testnet `TestGovernance` instances (eth-sepolia, base-sepolia, optimism-sepolia, scroll-sepolia, avalanche-fuji) share the full functional interface with `SuperfluidGovernanceII`, so they are now exposed under the existing `governance` export with the `SuperfluidGovernanceII` ABI.
