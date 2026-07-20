"use client";

import { useQuery } from "@tanstack/react-query";
import superjson from "superjson";

import { API_ENDPOINTS } from "../lib/endpoints";
import type { ProgramApp } from "../types/program-app";

/**
 * The browser imported `getProgramApps` through server-action id
 * `0050c3f0d604f9162ceb3faa2d83005031b4be6b5f`. Its server-only body was not
 * shipped. The deployment's observable `/api/programs` route returns the same
 * SuperJSON-encoded `ProgramApp[]`, so it is the source-backed transport used by
 * this standalone reconstruction.
 */
export async function fetchProgramApps(): Promise<ProgramApp[]> {
  const response = await fetch(API_ENDPOINTS.programs);
  if (!response.ok) throw new Error("Failed to fetch programs");
  return superjson.parse<ProgramApp[]>(await response.text());
}

export function useProgramApps(enabled = true) {
  return useQuery({
    queryKey: ["programApps"],
    queryFn: fetchProgramApps,
    enabled,
  });
}
