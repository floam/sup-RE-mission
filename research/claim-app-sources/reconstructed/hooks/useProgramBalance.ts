"use client";

// Inferred reconstruction from webpack module 22448.
// The generated contract-hook imports are inferred names for bundle modules 80751 and 69779.

import { useQuery } from "@tanstack/react-query";

import { useAirdropChain } from "@/hooks/useAirdropChain";
import {
  useFluidEPProgramManagerGetProgramPool,
  useSuperfluidPoolRead,
} from "@/generated/contracts";
import type { ProgramBalance } from "../types/program-app";

export interface UseProgramBalanceOptions {
  lockerAddress?: `0x${string}`;
  programId?: bigint;
}

export function useProgramBalance({
  lockerAddress,
  programId,
}: UseProgramBalanceOptions) {
  const { airdropChain } = useAirdropChain();

  const { data: poolAddress } = useFluidEPProgramManagerGetProgramPool({
    functionName: "getProgramPool",
    chainId: airdropChain.id,
    account: lockerAddress,
    args: [programId],
    query: { enabled: Boolean(lockerAddress) && programId !== undefined },
  });

  const {
    data: totalReceived,
    dataUpdatedAt: totalReceivedUpdatedAt,
  } = useSuperfluidPoolRead({
    functionName: "getTotalAmountReceivedByMember",
    chainId: airdropChain.id,
    account: lockerAddress,
    address: poolAddress,
    args: [lockerAddress],
    query: { enabled: Boolean(lockerAddress) && Boolean(poolAddress) },
  });

  const { data: memberFlowRate } = useSuperfluidPoolRead({
    functionName: "getMemberFlowRate",
    chainId: airdropChain.id,
    account: lockerAddress,
    address: poolAddress,
    args: [lockerAddress],
    query: { enabled: Boolean(lockerAddress) && Boolean(poolAddress) },
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
