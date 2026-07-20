"use client";

// Inferred reconstruction from webpack module 22448 and Sentry source metadata.

import { useState } from "react";

import { FluidApps } from "./FluidApps";
import {
  getDefaultSeasonFilter,
  SeasonFilter,
  type SeasonFilterValue,
} from "./SeasonFilter";
import type { ProgramApp } from "../types/program-app";

export interface FilteredFluidAppsProps {
  apps: ProgramApp[];
}

export function FilteredFluidApps({ apps }: FilteredFluidAppsProps) {
  const [season, setSeason] = useState<SeasonFilterValue>(() => getDefaultSeasonFilter(apps));

  const filteredApps = (() => {
    if (season === "Ongoing") {
      return apps.filter(
        (app) =>
          app.program?.onchainInfo?.isFundingStarted &&
          !app.program.onchainInfo.isFundingFinished &&
          !app.isExpired,
      );
    }

    const seasonNumber = season.slice("Season ".length);
    return apps.filter((app) => app.season === seasonNumber);
  })();

  return (
    <div className="space-y-8">
      <SeasonFilter value={season} onChange={setSeason} />
      <FluidApps apps={filteredApps} />
    </div>
  );
}
