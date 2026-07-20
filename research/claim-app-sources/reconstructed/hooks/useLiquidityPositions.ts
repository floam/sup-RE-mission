"use client";

import { useQuery } from "@tanstack/react-query";

import { useExpectedChains } from "../contexts/ExpectedChainContext";
import { EXTERNAL_ENDPOINTS } from "../lib/endpoints";
import type { Address } from "../types/program-app";
import { useRecentTransactions } from "./useRecentTransactions";

const GET_ACTIVE_LIQUIDITY_POSITIONS = `
  query GetActiveLiquidityPositions($locker: String!) {
    liquidityPositions(where: { locker: $locker, isActive: true }) { tokenId }
  }
`;

export function useActiveLiquidityPositions(lockerAddress?: Address) {
  const { airdropChain } = useExpectedChains();
  const created = useRecentTransactions("liquidity-position-created", 30);
  const withdrawn = useRecentTransactions("liquidity-position-withdrawn", 30);
  const endpoint =
    airdropChain.id === 8453
      ? EXTERNAL_ENDPOINTS.supSubgraph
      : EXTERNAL_ENDPOINTS.supTestSubgraph;
  return useQuery({
    queryKey: ["active-liquidity-positions", lockerAddress ?? null],
    enabled: Boolean(lockerAddress),
    refetchInterval: created.length > 0 || withdrawn.length > 0 ? 5_000 : false,
    queryFn: async () => {
      if (!lockerAddress) return null;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: GET_ACTIVE_LIQUIDITY_POSITIONS,
          variables: { locker: lockerAddress.toLowerCase() },
        }),
      });
      if (!response.ok)
        throw new Error("Failed to fetch active liquidity positions");
      const body = (await response.json()) as {
        data: { liquidityPositions?: { tokenId: string }[] };
      };
      const tokenIds =
        body.data.liquidityPositions?.map((position) =>
          BigInt(position.tokenId),
        ) ?? [];
      return { tokenIds, hasPositions: tokenIds.length > 0 };
    },
  });
}
