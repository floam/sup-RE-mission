"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";

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
    <div className="space-y-6">
      <section className="relative flex min-h-[400px] items-center justify-center overflow-hidden rounded-lg border border-[#E9E9E9] bg-[#EEFFE7] px-4 py-8 text-center text-black">
        <div className="absolute inset-0">
          <Image
            src="/liquidity-cover-gradient.png"
            alt=""
            fill
            priority
            quality={75}
            className="object-cover object-left-top"
          />
          <Image
            src="/liquidity-cover-fractal-center.svg"
            alt=""
            fill
            className="object-cover object-top opacity-10"
          />
          <Image
            src="/liquidity-cover-left.png"
            alt=""
            fill
            priority
            quality={75}
            className="hidden object-contain object-left md:block"
          />
          <Image
            src="/liquidity-cover-right.png"
            alt=""
            fill
            priority
            quality={75}
            className="hidden object-contain object-right md:block"
          />
        </div>
        <div className="relative z-10 max-w-2xl">
          <h1 className="mt-8 mb-4 text-green-superdark text-h4 md:text-h2 lg:text-h1">
            Make it liquid
          </h1>
          <p className="mb-12 text-alto-dark uppercase">
            ADD YOUR SUP AND ETH TO EARN TRADING FEES
            <br />
            AND SUPPORT THE GROWING SUPERFLUID ECOSYSTEM
          </p>
          <AddLiquidityButton hasPositions={hasPositions} />
        </div>
      </section>
      <LiquidityStats
        lpRewardsAPR={apr}
        bonusAPR={bonusApr}
        hasPositions={hasPositions}
        poolMetrics={metrics}
        earnings={earnings.data}
      />
    </div>
  );
}
