"use client";

import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { gdaPoolAbi } from "@sfpro/sdk/abi/core";

import { useExpectedChains } from "../contexts/ExpectedChainContext";
import type { Address } from "../types/program-app";

export function useAccumulatedStakingRewards({
  lockerAddress,
  distributionPool,
}: {
  lockerAddress?: Address;
  distributionPool?: Address;
}) {
  const { airdropChain } = useExpectedChains();
  const received = useReadContract({
    abi: gdaPoolAbi,
    address: distributionPool,
    functionName: "getTotalAmountReceivedByMember",
    args: lockerAddress ? [lockerAddress] : undefined,
    chainId: airdropChain.id,
    query: { enabled: Boolean(lockerAddress && distributionPool) },
  });
  const flowRate = useReadContract({
    abi: gdaPoolAbi,
    address: distributionPool,
    functionName: "getMemberFlowRate",
    args: lockerAddress ? [lockerAddress] : undefined,
    chainId: airdropChain.id,
    query: { enabled: Boolean(lockerAddress && distributionPool) },
  });
  return useQuery({
    queryKey: [
      "accumulated-rewards",
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
