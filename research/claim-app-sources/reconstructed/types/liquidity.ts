import type { Address } from "./program-app";

export interface LiquidityPoolStats {
  token0Address?: Address;
  token1Address?: Address;
  totalValueLockedToken0: string;
  totalValueLockedToken1: string;
  volumeToken0: string;
  volumeToken1: string;
  feeTier: string;
}

export interface LiquidityRewardStats {
  apr: number;
  bonusApr: number;
  totalLiquidity: bigint;
  totalDistributed: bigint;
  totalDistributedFlowRate: bigint;
  lpDistributionPool?: Address;
  tvlUSD?: string;
}

export interface LiquidityPositionView {
  tokenId: bigint;
  liquidity: bigint;
  amount0: bigint;
  amount1: bigint;
  supAmount: bigint;
  ethAmount: bigint;
  feesSUP: bigint;
  feesETH: bigint;
  cooldownTimestamp?: bigint;
  taxFreeExitTimestamp?: bigint;
}
