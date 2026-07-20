"use client";

import { getAddress } from "viem";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { EXTERNAL_ENDPOINTS } from "../lib/endpoints";
import { truncateAddress } from "../lib/format";
import type { Address, AddressProfile } from "../types/program-app";

interface WhoisProfile {
  recommendedName?: string;
  recommendedAvatar?: string;
  [field: string]: unknown;
}

export function useAddressProfile(address?: Address) {
  const normalized =
    address && /^0x[0-9a-fA-F]{40}$/.test(address)
      ? (address.toLowerCase() as Address)
      : null;
  const { data } = useQuery<WhoisProfile | null>({
    queryKey: ["profile", normalized],
    queryFn: async () => {
      if (!normalized) return null;
      const response = await fetch(EXTERNAL_ENDPOINTS.whois(normalized));
      return response.ok ? response.json() : null;
    },
  });
  return useMemo<AddressProfile | null>(() => {
    if (!normalized) return null;
    const checksummed = getAddress(normalized);
    return {
      addressChecksummed: checksummed,
      addressTruncated: truncateAddress(checksummed),
      profile: data ?? null,
      primaryName: data?.recommendedName ?? null,
      primaryAvatarUrl: data?.recommendedAvatar ?? null,
    };
  }, [data, normalized]);
}
