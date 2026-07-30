"use client";

import { useReadContract } from "wagmi";
import { programManagerAbi } from "@sfpro/sdk/abi/sup";
import { gdaPoolAbi } from "@sfpro/sdk/abi/core";

import { APP_CHAIN } from "../config/chains";
import { PROGRAM_MANAGER_ADDRESS } from "../contracts/app-contracts";

export function useProgramTotalFlowRate(programId?: bigint) {
  const managerAddress = PROGRAM_MANAGER_ADDRESS[APP_CHAIN.id];
  const { data: poolAddress } = useReadContract({
    abi: programManagerAbi,
    address: managerAddress,
    functionName: "getProgramPool",
    chainId: APP_CHAIN.id,
    args: [programId],
    // The deployed hook intentionally left this query enabled even if the id is undefined.
    query: { enabled: true },
  });
  const { data: totalFlowRate } = useReadContract({
    abi: gdaPoolAbi,
    address: poolAddress,
    functionName: "getTotalFlowRate",
    chainId: APP_CHAIN.id,
    query: { enabled: Boolean(poolAddress) },
  });
  return { totalFlowRate };
}
