"use client";

import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { gdaPoolReadAbi } from "../contracts/app-contracts";

import { useExpectedChains } from "../contexts/ExpectedChainContext";
import type { Address } from "../types/program-app";

export function useAccumulatedLiquidityRewards({
  lockerAddress,
  distributionPool,
}: {
  lockerAddress?: Address;
  distributionPool?: Address;
}) {
  const { airdropChain } = useExpectedChains();
  const received = useReadContract({
    abi: gdaPoolReadAbi,
    address: distributionPool,
    functionName: "getTotalAmountReceivedByMember",
    chainId: airdropChain.id,
    args: lockerAddress ? [lockerAddress] : undefined,
    query: { enabled: Boolean(lockerAddress && distributionPool) },
  });
  const flowRate = useReadContract({
    abi: gdaPoolReadAbi,
    address: distributionPool,
    functionName: "getMemberFlowRate",
    chainId: airdropChain.id,
    args: lockerAddress ? [lockerAddress] : undefined,
    query: { enabled: Boolean(lockerAddress && distributionPool) },
  });
  return useQuery({
    queryKey: [
      "accumulated-liquidity-rewards",
      lockerAddress,
      distributionPool,
      received.data,
      flowRate.data,
      received.dataUpdatedAt,
    ],
    enabled: Boolean(lockerAddress && distributionPool),
    queryFn: () =>
      received.data === undefined ||
      flowRate.data === undefined ||
      received.dataUpdatedAt === undefined
        ? null
        : {
            balance: received.data,
            flowRate: flowRate.data,
            timestamp: BigInt(Math.floor(received.dataUpdatedAt / 1_000)),
          },
  });
}
