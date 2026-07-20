import { formatUsd } from "../../lib/format";
import type { LiquidityPoolStats } from "../../types/liquidity";
import { FlowingBalance } from "../FlowingBalance";
import { LiquidityPoolComposition } from "./LiquidityPoolComposition";

export function calculatePoolUsdMetrics(
  stats: LiquidityPoolStats | undefined,
  input: {
    ethPriceUSD?: number;
    supPriceUSD?: number;
    supAddress?: string;
  },
) {
  if (
    !stats ||
    !input.ethPriceUSD ||
    !input.supPriceUSD ||
    !stats.token0Address ||
    !stats.token1Address ||
    !input.supAddress
  )
    return { tvlUSD: "0", volumeUSD: "0", feesUSD: "0" };
  const isSupToken0 =
    stats.token0Address.toLowerCase() === input.supAddress.toLowerCase();
  const token0Price = isSupToken0 ? input.supPriceUSD : input.ethPriceUSD;
  const token1Price = isSupToken0 ? input.ethPriceUSD : input.supPriceUSD;
  const tvl =
    Number.parseFloat(stats.totalValueLockedToken0) * token0Price +
    Number.parseFloat(stats.totalValueLockedToken1) * token1Price;
  const volume =
    Number.parseFloat(stats.volumeToken0) * token0Price +
    Number.parseFloat(stats.volumeToken1) * token1Price;
  return {
    tvlUSD: tvl.toString(),
    volumeUSD: volume.toString(),
    feesUSD: (
      (Number.parseFloat(stats.feeTier) / 1_000_000) *
      volume
    ).toString(),
  };
}

export function LiquidityStats({
  lpRewardsAPR,
  bonusAPR,
  hasPositions,
  poolMetrics,
  earnings,
}: {
  lpRewardsAPR?: number;
  bonusAPR?: number;
  hasPositions: boolean;
  poolMetrics?: { tvlUSD: string; volumeUSD: string; feesUSD: string };
  earnings?: { balance: bigint; timestamp: bigint; flowRate: bigint } | null;
}) {
  const apr =
    lpRewardsAPR === undefined
      ? "—"
      : bonusAPR
        ? `${lpRewardsAPR.toFixed(0)}% + ${bonusAPR.toFixed(0)}%`
        : `${lpRewardsAPR.toFixed(0)}%`;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(auto,450px)_1fr]">
        <div className="relative overflow-hidden rounded-lg bg-green-superdark p-6 text-center text-white">
          <div className="mb-2 text-green-sf uppercase">
            {hasPositions ? "Current Earnings" : "Total APR"}
          </div>
          <div className="text-h5">
            {hasPositions && earnings ? (
              <FlowingBalance
                balance={earnings.balance}
                balanceTimestamp={earnings.timestamp}
                flowRate={earnings.flowRate}
              />
            ) : (
              apr
            )}
          </div>
          {hasPositions && <div>SUP</div>}
        </div>
        <div className="grid grid-cols-3 rounded-lg border bg-gradient-to-t from-[#EEFFE7] to-gray-50 text-center">
          <div className="p-6">
            <div className="text-green uppercase">TVL</div>
            <strong>{formatUsd(Number(poolMetrics?.tvlUSD ?? 0))}</strong>
          </div>
          <div className="p-6">
            <div className="text-green uppercase">24H Volume</div>
            <strong>{formatUsd(Number(poolMetrics?.volumeUSD ?? 0))}</strong>
          </div>
          <div className="p-6">
            <div className="text-green uppercase">24H Fees</div>
            <strong>{formatUsd(Number(poolMetrics?.feesUSD ?? 0))}</strong>
          </div>
        </div>
        <LiquidityPoolComposition hasPositions={hasPositions} />
      </div>
    </div>
  );
}
