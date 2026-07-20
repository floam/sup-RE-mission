"use client";

// Inferred reconstruction from webpack module 22448.

import { useAirdropChain } from "@/hooks/useAirdropChain";
import {
  useFluidEPProgramManagerGetProgramPool,
  useSuperfluidPoolRead,
} from "@/generated/contracts";

export function useProgramTotalFlowRate(programId?: bigint) {
  const { airdropChain } = useAirdropChain();

  const { data: poolAddress } = useFluidEPProgramManagerGetProgramPool({
    functionName: "getProgramPool",
    chainId: airdropChain.id,
    args: [programId],
    query: { enabled: true },
  });

  const { data: totalFlowRate } = useSuperfluidPoolRead({
    functionName: "getTotalFlowRate",
    chainId: airdropChain.id,
    address: poolAddress,
    query: { enabled: Boolean(poolAddress) },
  });

  return { totalFlowRate };
}
