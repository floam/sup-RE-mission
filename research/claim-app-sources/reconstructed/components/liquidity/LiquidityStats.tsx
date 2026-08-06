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
    <section aria-label="Liquidity statistics">
      <div className="route-lines">
        <p className="route-line">
          <strong>{hasPositions ? "current earnings" : "total APR"}</strong>
          <span>
            {hasPositions && earnings ? (
              <>
                <FlowingBalance
                  balance={earnings.balance}
                  balanceTimestamp={earnings.timestamp}
                  flowRate={earnings.flowRate}
                />{" "}
                SUP
              </>
            ) : (
              apr
            )}
          </span>
        </p>
        <p className="route-line">
          <strong>TVL</strong>
          <span>{formatUsd(Number(poolMetrics?.tvlUSD ?? 0))}</span>
        </p>
        <p className="route-line">
          <strong>24h volume</strong>
          <span>{formatUsd(Number(poolMetrics?.volumeUSD ?? 0))}</span>
        </p>
        <p className="route-line">
          <strong>24h fees</strong>
          <span>{formatUsd(Number(poolMetrics?.feesUSD ?? 0))}</span>
        </p>
      </div>
      <LiquidityPoolComposition hasPositions={hasPositions} />
    </section>
  );
}
