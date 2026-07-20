"use client";

import { useLiquidityPosition } from "../../hooks/useLiquidityPosition";
import { useTokenPrice } from "../../hooks/useTokenPrices";
import { useExpectedChains } from "../../contexts/ExpectedChainContext";
import { useLocker } from "../../contexts/LockerContext";
import {
  SUP_TOKEN_ADDRESS_BY_CHAIN,
  WETH_ADDRESS,
} from "../../contracts/app-contracts";
import { formatTokenAmount, formatUsd } from "../../lib/format";
import { TokenIcon } from "../TokenIcon";

export function WithdrawPositionListItem({
  tokenId,
  isSelected,
  onSelect,
}: {
  tokenId: bigint;
  isSelected: boolean;
  onSelect(): void;
}) {
  const { airdropChain } = useExpectedChains();
  const { lockerAddress } = useLocker();
  const position = useLiquidityPosition(tokenId, lockerAddress);
  const ethPrice = useTokenPrice(airdropChain.id, WETH_ADDRESS[8453]);
  const supPrice = useTokenPrice(
    airdropChain.id,
    SUP_TOKEN_ADDRESS_BY_CHAIN[airdropChain.id],
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
        {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        },
      )
    : "—";
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={position.isLoading}
      className={`flex w-full overflow-hidden rounded-[20px] border ${isSelected ? "border-purple bg-violet-light" : "border-alto bg-platinum"}`}
    >
      <div className="flex min-w-[145px] flex-col gap-3 bg-violet-dark px-6 py-4 text-white">
        <span className="flex items-center gap-2">
          <TokenIcon token="eth" size={20} />
          {data ? formatTokenAmount(data.ethAmount, 4) : "..."}
        </span>
        <span className="flex items-center gap-2">
          <TokenIcon token="sup" size={20} />
          {data ? formatTokenAmount(data.supAmount, 2) : "..."}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-6 py-2 text-sm">
        <span className="flex justify-between py-1">
          <small>TVL</small>
          <strong>{data ? formatUsd(tvl) : "..."}</strong>
        </span>
        <span className="flex justify-between border-y border-white py-1">
          <small>Fees earned</small>
          <strong>{data ? formatUsd(fees) : "..."}</strong>
        </span>
        <span className="flex justify-between py-1">
          <small>Zero Charges Withdraw</small>
          <strong>{taxFreeDate}</strong>
        </span>
      </div>
    </button>
  );
}
