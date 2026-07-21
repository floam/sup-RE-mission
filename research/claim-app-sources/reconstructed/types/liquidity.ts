import type { Address } from "./program-app";

export interface LiquidityPoolStats {
  token0Address: Address;
  token1Address: Address;
  totalValueLockedToken0: string;
  totalValueLockedToken1: string;
  volumeToken0: string;
  volumeToken1: string;
  feeTier: string;
  date: number;
  lastUpdatedAt: number;
}

export interface SerializedLiquidityRewardStats {
  apr: number;
  bonusApr: number;
  totalLiquidity: string;
  totalDistributed: string;
  totalDistributedFlowRate: string;
  totalDistributedTimestamp: number;
  totalLPs: number;
  lastUpdatedAt: number;
  lpDistributionPool: Address;
}

export interface LiquidityRewardStats
  extends Omit<
    SerializedLiquidityRewardStats,
    "totalLiquidity" | "totalDistributed" | "totalDistributedFlowRate"
  > {
  totalLiquidity: bigint;
  totalDistributed: bigint;
  totalDistributedFlowRate: bigint;
}

export function deserializeLiquidityRewardStats(
  stats: SerializedLiquidityRewardStats,
): LiquidityRewardStats {
  return {
    ...stats,
    totalLiquidity: BigInt(stats.totalLiquidity),
    totalDistributed: BigInt(stats.totalDistributed),
    totalDistributedFlowRate: BigInt(stats.totalDistributedFlowRate),
  };
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
