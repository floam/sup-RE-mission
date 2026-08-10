import { BASE_CHAIN_ID } from "./chains";
import type { Address } from "../types/program-app";

export interface SwapCampaignToken {
  symbol: "USDCx" | "USDSx";
  iconUrl: string;
  superTokenAddress: Address;
  underlyingTokenAddress: Address;
  underlyingDecimals: number;
}

export const SWAP_CAMPAIGN_TOKENS: readonly SwapCampaignToken[] = [
  {
    symbol: "USDCx",
    iconUrl: "https://tokenlist.superfluid.org/icons/usdc.svg",
    superTokenAddress: "0xD04383398dD2426297da660F9CCA3d439AF9ce1b",
    underlyingTokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    underlyingDecimals: 6,
  },
  {
    symbol: "USDSx",
    iconUrl: "https://tokenlist.superfluid.org/icons/usds.svg",
    superTokenAddress: "0xc325a14b9A2A7e25864195Fdd42D05Ce3e68E7F6",
    underlyingTokenAddress: "0x820C137fa70C8691f0e44Dc420a5e53c168921Dc",
    underlyingDecimals: 18,
  },
] as const;

export const SWAP_REFERRER_ADDRESS = {
  x: "0x01c91c4fa9e9c12334ae5cb2859165c3be68d09b",
  farcaster: "0x1a1285417d0ac312643b189022e27dcd960e37e0",
  discord: "0x60b8f544897803027b886748091ad6ab53451781",
} as const;

export const SWAP_CAMPAIGN_CHAIN_ID = BASE_CHAIN_ID;
export const SWAP_REFERRER_SESSION_KEY = "referrer";
