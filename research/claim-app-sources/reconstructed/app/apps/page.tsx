"use client";

import { FilteredAppsList } from "../../components/apps/FilteredAppsList";
import { useProgramApps } from "../../hooks/useProgramApps";

export default function CampaignsPage() {
  const apps = useProgramApps();
  return (
    <main>
      <header>
        <h1 className="text-h2">Campaigns</h1>
        <p>Explore Superfluid-powered apps and active SUP campaigns.</p>
      </header>
      {apps.isLoading ? (
        <div>Loading campaigns...</div>
      ) : apps.isError ? (
        <div>Unable to load campaigns.</div>
      ) : (
        <FilteredAppsList apps={apps.data ?? []} />
      )}
    </main>
  );
}
