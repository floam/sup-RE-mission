"use client";

import { useReadContract } from "wagmi";

import { APP_CHAIN } from "../config/chains";
import { gdaPoolReadAbi } from "../contracts/app-contracts";

export function useProgramTotalFlowRate(poolAddress?: `0x${string}`) {
  const { data: totalFlowRate } = useReadContract({
    abi: gdaPoolReadAbi,
    address: poolAddress,
    functionName: "getTotalFlowRate",
    chainId: APP_CHAIN.id,
    query: { enabled: Boolean(poolAddress) },
  });
  return { totalFlowRate };
}
