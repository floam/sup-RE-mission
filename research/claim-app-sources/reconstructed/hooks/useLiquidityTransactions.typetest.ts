/**
 * Compile-time regression tests for the ABI-derived liquidity write types.
 * `npm run typecheck` verifies both the accepted and rejected cases.
 */
import type { LockerWriteInput } from "./useLiquidityTransactions";

const address = "0x0000000000000000000000000000000000000001" as const;

const provideLiquidity: LockerWriteInput<
  "provideLiquidity",
  readonly [supAmount: bigint]
> = {
  lockerAddress: address,
  functionName: "provideLiquidity",
  args: [1n],
  value: 1n,
  enabled: true,
};

const collectFees: LockerWriteInput<
  "collectFees",
  readonly [tokenId: bigint]
> = {
  lockerAddress: address,
  functionName: "collectFees",
  args: [1n],
  // @ts-expect-error Nonpayable locker calls must not accept native value.
  value: 1n,
  enabled: true,
};

void provideLiquidity;
void collectFees;
