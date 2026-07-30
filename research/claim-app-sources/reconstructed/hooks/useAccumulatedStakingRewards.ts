"use client";

import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { gdaPoolReadAbi } from "../contracts/app-contracts";

import { APP_CHAIN } from "../config/chains";
import type { Address } from "../types/program-app";

export function useAccumulatedStakingRewards({
  lockerAddress,
  distributionPool,
}: {
  lockerAddress?: Address;
  distributionPool?: Address;
}) {
  const received = useReadContract({
    abi: gdaPoolReadAbi,
    address: distributionPool,
    functionName: "getTotalAmountReceivedByMember",
    args: lockerAddress ? [lockerAddress] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: Boolean(lockerAddress && distributionPool) },
  });
  const flowRate = useReadContract({
    abi: gdaPoolReadAbi,
    address: distributionPool,
    functionName: "getMemberFlowRate",
    args: lockerAddress ? [lockerAddress] : undefined,
    chainId: APP_CHAIN.id,
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
