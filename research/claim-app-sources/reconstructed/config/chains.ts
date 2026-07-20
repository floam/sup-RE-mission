import { base, baseSepolia, type Chain } from "viem/chains";

export const BASE_CHAIN_ID = 8453 as const;
export const BASE_SEPOLIA_CHAIN_ID = 84532 as const;

/** Exact bundle gate: only the trimmed, lower-case string `true` enables testnet. */
export const isTestnetEnabled =
  process.env.NEXT_PUBLIC_ENABLE_TESTNET?.toLowerCase().trim() === "true";

export const governanceChain: Chain = isTestnetEnabled ? baseSepolia : base;
export const airdropChain: Chain = isTestnetEnabled ? baseSepolia : base;

export const SUPPORTED_CHAINS = [base, baseSepolia] as const;
