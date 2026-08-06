import { FormattedBalance } from "../FormattedBalance";

export function LiquidityPoolComposition({
  hasPositions,
  depositedEth = 0n,
  depositedSup = 0n,
  availableEth = 0n,
  availableSup = 0n,
}: {
  hasPositions: boolean;
  depositedEth?: bigint;
  depositedSup?: bigint;
  availableEth?: bigint;
  availableSup?: bigint;
}) {
  if (!hasPositions) return null;
  return (
    <div className="route-lines" aria-label="Liquidity pool composition">
      <p className="route-line">
        <strong>deposited ETH</strong>
        <span><FormattedBalance balance={depositedEth} decimalPlaces={4} /></span>
      </p>
      <p className="route-line">
        <strong>deposited SUP</strong>
        <span><FormattedBalance balance={depositedSup} /></span>
      </p>
      <p className="route-line">
        <strong>available ETH</strong>
        <span><FormattedBalance balance={availableEth} decimalPlaces={4} /></span>
      </p>
      <p className="route-line">
        <strong>available SUP</strong>
        <span><FormattedBalance balance={availableSup} /></span>
      </p>
    </div>
  );
}
