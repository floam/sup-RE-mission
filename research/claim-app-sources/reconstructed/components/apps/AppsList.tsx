"use client";

import groupBy from "lodash/groupBy";
import { Fragment } from "react";

import type { ProgramApp } from "../../types/program-app";
import { AppModalProvider } from "./AppOptionsModal";
import { ProgramAppCard } from "./ProgramAppCard";

const CATEGORY_ORDER = [
  "Social",
  "DeFi",
  "Donations",
  "Salaries & Grants",
  "Other",
  "Upcoming",
  "Completed",
] as const;

export function CategoryDelimiter({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={`grid w-full grid-cols-[1fr_auto_1fr] items-center gap-6 ${className ?? ""}`}
    >
      <div className="h-[2px] w-full bg-green-sf" />
      <div className="text-green text-subtitle1">{children}</div>
      <div className="h-[2px] w-full bg-green-sf" />
    </div>
  );
}

function displayCategory(app: ProgramApp): ProgramApp {
  return {
    ...app,
    category: !app.program
      ? "Upcoming"
      : app.program.onchainInfo?.isFundingFinished
        ? "Completed"
        : app.category,
  };
}

export function AppsList({ apps }: { apps: ProgramApp[] }) {
  const grouped = Object.entries(
    groupBy(
      apps
        .map(displayCategory)
        .reverse()
        .sort((a, b) =>
          a.program && !b.program ? -1 : !a.program && b.program ? 1 : 0,
        ),
      "category",
    ),
  ).sort(
    ([a], [b]) =>
      CATEGORY_ORDER.indexOf(a as never) - CATEGORY_ORDER.indexOf(b as never),
  );

  return (
    <AppModalProvider apps={apps}>
      {({ openAppModal }) => (
        <>
          {grouped.map(([category, categoryApps]) => (
            <Fragment key={category}>
              <CategoryDelimiter className="mt-14 mb-5">
                {category}
              </CategoryDelimiter>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2">
                {categoryApps.map((app) => (
                  <ProgramAppCard
                    key={app.name}
                    app={app}
                    onClick={() => openAppModal(app.appId)}
                  />
                ))}
              </div>
            </Fragment>
          ))}
        </>
      )}
    </AppModalProvider>
  );
}
