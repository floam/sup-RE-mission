"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

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

export function isOngoingProgram(app: ProgramApp): boolean {
  return Boolean(
    app.program?.onchainInfo?.isFundingStarted &&
      !app.program.onchainInfo.isFundingFinished &&
      !app.isExpired,
  );
}

export function getDefaultSeasonFilter(apps: ProgramApp[]): SeasonFilterValue {
  if (apps.some(isOngoingProgram)) return "Ongoing";
  const latest = apps.reduce(
    (highest, app) =>
      app.season ? Math.max(highest, Number(app.season)) : highest,
    0,
  );
  return latest > 0 ? (`Season ${latest}` as SeasonFilterValue) : "Ongoing";
}

export function filterAppsBySeason(
  apps: ProgramApp[],
  filter: SeasonFilterValue,
): ProgramApp[] {
  return filter === "Ongoing"
    ? apps.filter(isOngoingProgram)
    : apps.filter((app) => app.season === filter.slice("Season ".length));
}

export interface SeasonFilterProps {
  value: SeasonFilterValue;
  onChange(value: SeasonFilterValue): void;
}

export function SeasonFilter({ value, onChange }: SeasonFilterProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex justify-end">
      <div className="hidden gap-2 sm:flex">
        {SEASON_FILTERS.map((season) => (
          <button
            key={season}
            className={
              season === value ? "badge badge-primary" : "badge badge-gray"
            }
            onClick={() => onChange(season)}
          >
            {season}
          </button>
        ))}
      </div>
      <div className="relative sm:hidden">
        <button
          onClick={() => setOpen((current) => !current)}
          className="flex w-[180px] items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 font-medium text-sm hover:bg-gray-50"
        >
          {value}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div className="absolute top-full z-10 mt-1 w-full rounded-md border border-gray-200 bg-gray-50 shadow-lg">
            {SEASON_FILTERS.map((season) => (
              <button
                key={season}
                onClick={() => {
                  onChange(season);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                  value === season ? "bg-gray-100 font-medium" : ""
                }`}
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
