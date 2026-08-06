"use client";

import { useQuery } from "@tanstack/react-query";

import { APP_CHAIN } from "../../config/chains";
import { useLocker } from "../../contexts/LockerContext";
import {
  SUP_TOKEN_ADDRESS_BY_CHAIN,
  WETH_ADDRESS,
} from "../../contracts/app-contracts";
import { useAccumulatedLiquidityRewards } from "../../hooks/useAccumulatedLiquidityRewards";
import { useActiveLiquidityPositions } from "../../hooks/useLiquidityPositions";
import { useTokenPrice } from "../../hooks/useTokenPrices";
import {
  getLiquidityPoolStats,
  getLiquidityRewardsStats,
} from "../../server-actions/stats";
import { deserializeLiquidityRewardStats } from "../../types/liquidity";
import { AddLiquidityButton } from "./AddLiquidityButton";
import { calculatePoolUsdMetrics, LiquidityStats } from "./LiquidityStats";

export function LiquidityFeature() {
  const { data: poolStats } = useQuery({
    queryKey: ["liquidity-pool-metrics"],
    queryFn: getLiquidityPoolStats,
  });
  const { data: rewardsStats } = useQuery({
    queryKey: ["liquidityRewardsStats"],
    queryFn: getLiquidityRewardsStats,
    select: deserializeLiquidityRewardStats,
  });
  const { lockerAddress } = useLocker();
  const positions = useActiveLiquidityPositions(lockerAddress);
  const ethPrice = useTokenPrice(APP_CHAIN.id, WETH_ADDRESS[APP_CHAIN.id]);
  const supPrice = useTokenPrice(
    APP_CHAIN.id,
    SUP_TOKEN_ADDRESS_BY_CHAIN[APP_CHAIN.id],
  );
  const earnings = useAccumulatedLiquidityRewards({
    lockerAddress,
    distributionPool: rewardsStats?.lpDistributionPool,
  });
  const hasPositions = (positions.data?.tokenIds.length ?? 0) > 0;
  const metrics = calculatePoolUsdMetrics(poolStats, {
    ethPriceUSD: ethPrice.data ?? undefined,
    supPriceUSD: supPrice.data ?? undefined,
    supAddress: SUP_TOKEN_ADDRESS_BY_CHAIN[APP_CHAIN.id],
  });
  const apr = rewardsStats?.apr === 0 ? undefined : rewardsStats?.apr;
  const bonusApr =
    rewardsStats?.bonusApr === 0 ? undefined : rewardsStats?.bonusApr;

  return (
    <main className="terminal-page">
      <p className="command-line">
        <span className="prompt">&gt;</span> liquidity
      </p>
      <p>provide SUP and ETH to the pool, earn fees, and review rewards</p>
      <p><AddLiquidityButton hasPositions={hasPositions} /></p>
      <LiquidityStats
        lpRewardsAPR={apr}
        bonusAPR={bonusApr}
        hasPositions={hasPositions}
        poolMetrics={metrics}
        earnings={earnings.data}
      />
    </main>
  );
}
