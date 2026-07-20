"use client";

import orderBy from "lodash/orderBy";
import { useEffect, useMemo, useState } from "react";

import { useLocker } from "../contexts/LockerContext";
import { SUP_SYMBOL } from "../lib/format";
import type { ProgramApp } from "../types/program-app";
import { ComponentResetWhenAccountChanges } from "./ComponentResetWhenAccountChanges";
import { FluidAppCard } from "./FluidAppCard";

export function FluidApps({ apps }: { apps: ProgramApp[] }) {
  const { accountAddress } = useLocker();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const sortedApps = useMemo(
    () =>
      orderBy(apps, [
        (app) => !app.program,
        (app) => {
          if (!app.program) return 3;
          const info = app.program.onchainInfo;
          if (info.isFundingStarted && !info.isFundingFinished) return 0;
          if (info.isFundingStarted || info.isFundingFinished) return 2;
          return 1;
        },
      ]),
    [apps],
  );
  if (!mounted) return null;
  return (
    <section className="w-full rounded-lg border-none bg-gray-100 shadow-none">
      <header className="p-6 text-sm max-md:hidden">
        <div
          className="grid gap-4 font-medium text-gray-800"
          style={{
            gridTemplateColumns: `2fr 0.75fr 1fr 2fr${accountAddress ? " 1fr" : ""} 120px`,
          }}
        >
          <div>Campaign</div>
          <div>Category</div>
          <div>Flow Rate</div>
          <div>{SUP_SYMBOL} Distributed</div>
          {accountAddress && <div>You Earned</div>}
          <div>Action</div>
        </div>
      </header>
      <div className="space-y-4 p-2">
        {sortedApps.map((app) => (
          <ComponentResetWhenAccountChanges key={app.appId}>
            <FluidAppCard programApp={app} />
          </ComponentResetWhenAccountChanges>
        ))}
      </div>
    </section>
  );
}
