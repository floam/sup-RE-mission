"use client";

import { programManagerAbi } from "@sfpro/sdk/abi/sup";
import { useReadContract } from "wagmi";

import { APP_CHAIN } from "../config/chains";
import {
  gdaPoolReadAbi,
  PROGRAM_MANAGER_ADDRESS,
} from "../contracts/app-contracts";

export function useProgramTotalFlowRate(programId?: bigint) {
  const managerAddress = PROGRAM_MANAGER_ADDRESS[APP_CHAIN.id];
  const { data: poolAddress } = useReadContract({
    abi: programManagerAbi,
    address: managerAddress,
    functionName: "getProgramPool",
    chainId: APP_CHAIN.id,
    args: [programId],
    query: { enabled: programId !== undefined },
  });
  const { data: totalFlowRate } = useReadContract({
    abi: gdaPoolReadAbi,
    address: poolAddress,
    functionName: "getTotalFlowRate",
    chainId: APP_CHAIN.id,
    query: { enabled: Boolean(poolAddress) },
  });
  return { totalFlowRate };
}
