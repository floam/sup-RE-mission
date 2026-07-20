"use client";

// Inferred reconstruction from webpack module 22448 and Sentry source metadata.

import { useEffect, useMemo, useState } from "react";
import orderBy from "lodash/orderBy";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComponentResetWhenAccountChanges } from "@/components/ComponentResetWhenAccountChanges";
import { useLockerAccount } from "@/hooks/useLockerAccount";
import { SUP_SYMBOL } from "@/lib/constants";
import { FluidAppCard } from "./FluidAppCard";
import type { ProgramApp } from "../types/program-app";

export interface FluidAppsProps {
  apps: ProgramApp[];
}

export function FluidApps({ apps }: FluidAppsProps) {
  const { accountAddress } = useLockerAccount();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);

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

  if (!isMounted) return null;

  return (
    <Card className="w-full border-none bg-gray-100 shadow-none">
      <CardHeader className="text-sm max-md:hidden">
        <CardTitle className="text-gray-800">
          <div
            className="grid gap-4 font-medium"
            style={{ gridTemplateColumns: `2fr 0.75fr 1fr 2fr${accountAddress ? " 1fr" : ""} 120px` }}
          >
            <div>Campaign</div>
            <div>Category</div>
            <div>Flow Rate</div>
            <div>{SUP_SYMBOL} Distributed</div>
            {!!accountAddress && <div>You Earned</div>}
            <div>Action</div>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 p-2">
        {sortedApps.map((app) => (
          <ComponentResetWhenAccountChanges key={app.appId}>
            <FluidAppCard programApp={app} />
          </ComponentResetWhenAccountChanges>
        ))}
      </CardContent>
    </Card>
  );
}
