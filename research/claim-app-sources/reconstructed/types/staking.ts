import type { Address } from "./program-app";

export interface SerializedStakingStats {
  totalStaked: string;
  totalDistributed: string;
  totalDistributedFlowRate: string;
  totalDistributedTimestamp: number;
  apr: number | string;
  bonusApr: number | string;
  withdrawalPeriodDays: number;
  taxDistributionPool?: Address;
}

export interface StakingStats
  extends Omit<
    SerializedStakingStats,
    "totalStaked" | "totalDistributed" | "totalDistributedFlowRate"
  > {
  totalStaked: bigint;
  totalDistributed: bigint;
  totalDistributedFlowRate: bigint;
}

export function deserializeStakingStats(
  stats: SerializedStakingStats,
): StakingStats {
  return {
    ...stats,
    totalStaked: BigInt(stats.totalStaked),
    totalDistributed: BigInt(stats.totalDistributed),
    totalDistributedFlowRate: BigInt(stats.totalDistributedFlowRate),
  };
}
