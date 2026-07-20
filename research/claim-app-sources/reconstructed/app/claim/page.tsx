"use client";

import { ClaimSection } from "../../components/claim/ClaimSection";
import { ComponentResetWhenAccountChanges } from "../../components/ComponentResetWhenAccountChanges";
import { FilteredFluidApps } from "../../components/FilteredFluidApps";
import { useProgramApps } from "../../hooks/useProgramApps";
import type { ProgramPoolInfoLoader } from "../../hooks/useClaimFlowMetrics";

export default function ClaimPage({
  loadProgramPoolInfos,
}: {
  loadProgramPoolInfos?: ProgramPoolInfoLoader;
} = {}) {
  const apps = useProgramApps();
  return (
    <main className="space-y-8">
      <header>
        <h1 className="text-h2">Claim SUP</h1>
        <p>Claim your share from the Superfluid programs you participate in.</p>
      </header>
      <section className="grid min-h-[680px] grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-green-superdark p-8 text-white">
          <span className="uppercase">Season 6</span>
          <h2 className="text-h4 text-green-sf">Get paid every second</h2>
          <p>
            Use ecosystem apps, check back daily, and claim or grow your SUP
            stream.
          </p>
          <ol className="mt-8 space-y-4">
            <li>1. Use apps to become eligible.</li>
            <li>2. Create your Reserve and choose a delegate.</li>
            <li>3. Claim a continuously streaming SUP reward.</li>
          </ol>
        </div>
        <ComponentResetWhenAccountChanges>
          <ClaimSection loadProgramPoolInfos={loadProgramPoolInfos} />
        </ComponentResetWhenAccountChanges>
      </section>
      {apps.isLoading ? (
        <div>Loading campaigns...</div>
      ) : apps.isError ? (
        <div>Unable to load campaigns.</div>
      ) : (
        <FilteredFluidApps apps={apps.data ?? []} />
      )}
    </main>
  );
}
