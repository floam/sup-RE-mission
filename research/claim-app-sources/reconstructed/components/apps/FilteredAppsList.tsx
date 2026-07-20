"use client";

import { useState } from "react";

import {
  filterAppsBySeason,
  getDefaultSeasonFilter,
  SeasonFilter,
  type SeasonFilterValue,
} from "../SeasonFilter";
import type { ProgramApp } from "../../types/program-app";
import { AppsList } from "./AppsList";

export function FilteredAppsList({ apps }: { apps: ProgramApp[] }) {
  const [season, setSeason] = useState<SeasonFilterValue>(() =>
    getDefaultSeasonFilter(apps),
  );
  return (
    <div className="space-y-8 pt-12">
      <SeasonFilter value={season} onChange={setSeason} />
      <AppsList apps={filterAppsBySeason(apps, season)} />
    </div>
  );
}
