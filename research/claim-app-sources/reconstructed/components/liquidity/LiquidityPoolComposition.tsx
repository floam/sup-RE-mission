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
    <div className="relative h-full overflow-hidden rounded-lg border border-[#E9E9E9] bg-gradient-to-b from-[#EEFFE7] to-gray-50">
      <div className="flex h-full flex-col items-center sm:flex-row">
        <div className="w-full flex-1 px-8 py-6">
          <div className="mb-2 text-caption1 text-green uppercase">
            Deposited
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>ETH</span>
              <FormattedBalance balance={depositedEth} decimalPlaces={4} />
            </div>
            <div className="flex justify-between">
              <span>SUP</span>
              <FormattedBalance balance={depositedSup} />
            </div>
          </div>
        </div>
        <div className="h-px w-full bg-[#E9E9E9] sm:h-full sm:w-px" />
        <div className="w-full flex-1 px-8 py-6">
          <div className="mb-2 text-caption1 text-green uppercase">
            Available Balance
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>ETH</span>
              <FormattedBalance balance={availableEth} decimalPlaces={4} />
            </div>
            <div className="flex justify-between">
              <span>SUP</span>
              <FormattedBalance balance={availableSup} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
