"use client";

// Inferred reconstruction from webpack module 5104 and Sentry source metadata.

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProgramApp } from "../types/program-app";

export const SEASON_FILTERS = [
  "Ongoing",
  "Season 6",
  "Season 5",
  "Season 4",
  "Season 3",
  "Season 2",
  "Season 1",
] as const;

export type SeasonFilterValue = (typeof SEASON_FILTERS)[number];

export function getDefaultSeasonFilter(apps: ProgramApp[]): SeasonFilterValue {
  const hasOngoingProgram = apps.some(
    (app) =>
      app.program?.onchainInfo?.isFundingStarted &&
      !app.program.onchainInfo.isFundingFinished &&
      !app.isExpired,
  );

  if (hasOngoingProgram) return "Ongoing";

  const latestSeason = apps.reduce(
    (highest, app) => (app.season ? Math.max(highest, Number(app.season)) : highest),
    0,
  );

  return latestSeason > 0 ? (`Season ${latestSeason}` as SeasonFilterValue) : "Ongoing";
}

export interface SeasonFilterProps {
  value: SeasonFilterValue;
  onChange(value: SeasonFilterValue): void;
}

export function SeasonFilter({ value, onChange }: SeasonFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex justify-end">
      <div className="hidden gap-2 sm:flex">
        {SEASON_FILTERS.map((season) => (
          <Badge
            key={season}
            variant={value === season ? "primary" : "gray"}
            className="cursor-pointer"
            onClick={() => onChange(season)}
          >
            {season}
          </Badge>
        ))}
      </div>

      <div className="relative sm:hidden">
        <button
          onClick={() => setIsOpen((open) => !open)}
          className="flex w-[180px] items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 font-medium text-sm hover:bg-gray-50"
        >
          {value}
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <div className="absolute top-full z-10 mt-1 w-full rounded-md border border-gray-200 bg-gray-50 shadow-lg">
            {SEASON_FILTERS.map((season) => (
              <button
                key={season}
                onClick={() => {
                  onChange(season);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-gray-100",
                  value === season && "bg-gray-100 font-medium",
                )}
              >
                {season}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
