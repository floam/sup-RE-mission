"use client";

import { useQuery } from "@tanstack/react-query";

import { APP_CHAIN } from "../config/chains";
import { EXTERNAL_ENDPOINTS } from "../lib/endpoints";
import type { Address } from "../types/program-app";
import type { Fontaine } from "../components/reserve/FontaineListItem";
import { useRecentTransactions } from "./useRecentTransactions";

const GET_LOCKER_FONTAINES = `
  query GetLockerFontaines($locker: String!) {
    fontaines(where: { locker: $locker }) {
      id
      recipient
      unlockAmount
      unlockFlowRate
      blockTimestamp
    }
  }
`;

export function useFontaines(lockerAddress?: Address) {
  const recent = useRecentTransactions("stream-withdrawn-from-reserve", 30);
  const endpoint = EXTERNAL_ENDPOINTS.supSubgraph;
  return useQuery({
    queryKey: ["locker-fontaines", lockerAddress ?? null],
    enabled: Boolean(lockerAddress),
    refetchInterval: recent.length > 0 ? 5_000 : false,
    queryFn: async () => {
      if (!lockerAddress) return null;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: GET_LOCKER_FONTAINES,
          variables: { locker: lockerAddress.toLowerCase() },
        }),
      });
      if (!response.ok)
        throw new Error("Failed to fetch Reserve withdrawal streams");
      const body = (await response.json()) as {
        data: { fontaines?: Fontaine[] };
      };
      const fontaines = body.data.fontaines ?? [];
      return { fontaines, hasFontaines: fontaines.length > 0 };
    },
  });
}
