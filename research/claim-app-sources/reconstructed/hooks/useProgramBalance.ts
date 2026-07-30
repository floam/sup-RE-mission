"use client";

import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { programManagerAbi } from "@sfpro/sdk/abi/sup";
import { gdaPoolAbi } from "@sfpro/sdk/abi/core";

import { APP_CHAIN } from "../config/chains";
import { PROGRAM_MANAGER_ADDRESS } from "../contracts/app-contracts";
import type { Address, ProgramBalance } from "../types/program-app";

export interface UseProgramBalanceOptions {
  lockerAddress?: Address;
  programId?: bigint;
}

export function useProgramBalance({
  lockerAddress,
  programId,
}: UseProgramBalanceOptions) {
  const managerAddress = PROGRAM_MANAGER_ADDRESS[APP_CHAIN.id];

  const { data: poolAddress } = useReadContract({
    abi: programManagerAbi,
    address: managerAddress,
    functionName: "getProgramPool",
    chainId: APP_CHAIN.id,
    account: lockerAddress,
    args: programId === undefined ? undefined : [programId],
    query: { enabled: Boolean(lockerAddress) && programId !== undefined },
  });

  const { data: totalReceived, dataUpdatedAt: totalReceivedUpdatedAt } =
    useReadContract({
      abi: gdaPoolAbi,
      address: poolAddress,
      functionName: "getTotalAmountReceivedByMember",
      chainId: APP_CHAIN.id,
      account: lockerAddress,
      args: lockerAddress ? [lockerAddress] : undefined,
      query: { enabled: Boolean(lockerAddress && poolAddress) },
    });

  const { data: memberFlowRate } = useReadContract({
    abi: gdaPoolAbi,
    address: poolAddress,
    functionName: "getMemberFlowRate",
    chainId: APP_CHAIN.id,
    account: lockerAddress,
    args: lockerAddress ? [lockerAddress] : undefined,
    query: { enabled: Boolean(lockerAddress && poolAddress) },
  });

  return useQuery<ProgramBalance | null>({
    queryKey: [
      "program-balance",
      lockerAddress,
      programId,
      poolAddress,
      totalReceived,
      memberFlowRate,
      totalReceivedUpdatedAt,
    ],
    queryFn: () => {
      if (
        totalReceived === undefined ||
        memberFlowRate === undefined ||
        totalReceivedUpdatedAt === undefined
      ) {
        return null;
      }
      return {
        balance: totalReceived,
        flowRate: memberFlowRate,
        timestamp: BigInt(Math.floor(totalReceivedUpdatedAt / 1_000)),
      };
    },
  });
}
