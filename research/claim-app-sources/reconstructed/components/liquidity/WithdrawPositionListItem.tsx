"use client";

import { APP_CHAIN } from "../../config/chains";
import { useLocker } from "../../contexts/LockerContext";
import {
  SUP_TOKEN_ADDRESS_BY_CHAIN,
  WETH_ADDRESS,
} from "../../contracts/app-contracts";
import { useLiquidityPosition } from "../../hooks/useLiquidityPosition";
import { useTokenPrice } from "../../hooks/useTokenPrices";
import { formatTokenAmount, formatUsd } from "../../lib/format";

export function WithdrawPositionListItem({
  tokenId,
  isSelected,
  onSelect,
}: {
  tokenId: bigint;
  isSelected: boolean;
  onSelect(): void;
}) {
  const { lockerAddress } = useLocker();
  const position = useLiquidityPosition(tokenId, lockerAddress);
  const ethPrice = useTokenPrice(APP_CHAIN.id, WETH_ADDRESS[8453]);
  const supPrice = useTokenPrice(
    APP_CHAIN.id,
    SUP_TOKEN_ADDRESS_BY_CHAIN[APP_CHAIN.id],
  );
  const data = position.data;
  const tvl = data
    ? Number(formatTokenAmount(data.ethAmount, 8).replaceAll(",", "")) *
        (ethPrice.data ?? 0) +
      Number(formatTokenAmount(data.supAmount, 8).replaceAll(",", "")) *
        (supPrice.data ?? 0)
    : 0;
  const fees = data
    ? Number(formatTokenAmount(data.feesETH, 8).replaceAll(",", "")) *
        (ethPrice.data ?? 0) +
      Number(formatTokenAmount(data.feesSUP, 8).replaceAll(",", "")) *
        (supPrice.data ?? 0)
    : 0;
  const taxFreeDate = data?.taxFreeExitTimestamp
    ? new Date(Number(data.taxFreeExitTimestamp) * 1_000).toLocaleDateString(
        "en-US",
        { day: "numeric", month: "short" },
      )
    : "—";

  return (
    <p>
      <button
        type="button"
        onClick={onSelect}
        disabled={position.isLoading}
        className={isSelected ? "positive" : undefined}
      >
        {isSelected ? "[✓]" : "[ ]"} position #{tokenId.toString()}
      </button>{" "}
      <span>
        {data
          ? `${formatTokenAmount(data.ethAmount, 4)} ETH · ${formatTokenAmount(data.supAmount, 2)} SUP · ${formatUsd(tvl)} TVL · ${formatUsd(fees)} fees · fee-free ${taxFreeDate}`
          : "loading…"}
      </span>
    </p>
  );
}
