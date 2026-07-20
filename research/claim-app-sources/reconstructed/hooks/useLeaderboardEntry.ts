"use client";

import { useQuery } from "@tanstack/react-query";

import { API_ENDPOINTS } from "../lib/endpoints";
import type { Address, LeaderboardEntry } from "../types/program-app";

export function useLeaderboardEntry({
  address,
  enabled = Boolean(address),
}: {
  address?: Address;
  enabled?: boolean;
}) {
  const normalized = address?.toLowerCase();
  return useQuery<{ entry: LeaderboardEntry | null }>({
    queryKey: ["leaderboard-search", normalized],
    enabled,
    queryFn: async () => {
      const response = await fetch(API_ENDPOINTS.leaderboardSearch(address!));
      return response.json();
    },
  });
}
