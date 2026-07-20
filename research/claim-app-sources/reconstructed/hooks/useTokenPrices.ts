"use client";

import { useQuery } from "@tanstack/react-query";

import { BASE_CHAIN_ID } from "../config/chains";
import { WETH_ADDRESS } from "../contracts/app-contracts";
import { EXTERNAL_ENDPOINTS } from "../lib/endpoints";
import type { Address } from "../types/program-app";

interface LiFiTokenPrice {
  priceUSD: string;
}

export function useTokenPrice(chainId: number, tokenAddress?: Address) {
  return useQuery<number | null>({
    queryKey: ["token-price", chainId, tokenAddress],
    enabled: Boolean(tokenAddress),
    staleTime: 5 * 60 * 1_000,
    queryFn: async () => {
      if (!tokenAddress) return null;
      const response = await fetch(
        `${EXTERNAL_ENDPOINTS.liFiBase}/token?chain=${chainId}&token=${tokenAddress}`,
      );
      if (!response.ok) throw new Error("Failed to fetch token price");
      const token = (await response.json()) as LiFiTokenPrice;
      return Number(token.priceUSD);
    },
  });
}

export function useEthPrice() {
  return useTokenPrice(BASE_CHAIN_ID, WETH_ADDRESS[BASE_CHAIN_ID]);
}
