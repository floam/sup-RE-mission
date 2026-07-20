"use client";

import { useReadContract } from "wagmi";
import { programManagerAbi } from "@sfpro/sdk/abi/sup";
import { gdaPoolAbi } from "@sfpro/sdk/abi/core";

import { useExpectedChains } from "../contexts/ExpectedChainContext";
import { PROGRAM_MANAGER_ADDRESS } from "../contracts/app-contracts";

export function useProgramTotalFlowRate(programId?: bigint) {
  const { airdropChain } = useExpectedChains();
  const managerAddress = PROGRAM_MANAGER_ADDRESS[airdropChain.id as 8453];
  const { data: poolAddress } = useReadContract({
    abi: programManagerAbi,
    address: managerAddress,
    functionName: "getProgramPool",
    chainId: airdropChain.id,
    args: [programId],
    // The deployed hook intentionally left this query enabled even if the id is undefined.
    query: { enabled: true },
  });
  const { data: totalFlowRate } = useReadContract({
    abi: gdaPoolAbi,
    address: poolAddress,
    functionName: "getTotalFlowRate",
    chainId: airdropChain.id,
    query: { enabled: Boolean(poolAddress) },
  });
  return { totalFlowRate };
}
