"use client";

import { useQuery } from "@tanstack/react-query";

import { getProgramApps } from "../server-actions/programs";

export function useProgramApps() {
  return useQuery({
    queryKey: ["programApps"],
    queryFn: getProgramApps,
  });
}
