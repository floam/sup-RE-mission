"use client";

import { useState } from "react";

import { useAddressProfile } from "../../hooks/useAddressProfile";
import { formatMonthlyFlowRate } from "../../lib/format";
import type { LeaderboardEntry } from "../../types/program-app";

export function LeaderboardEntryCard({
  entry,
  isYou,
  dataTestId,
}: {
  entry: LeaderboardEntry;
  isYou: boolean;
  dataTestId?: string;
}) {
  const profile = useAddressProfile(entry.accountAddress);
  const [tooltip, setTooltip] = useState("Click to copy address");
  const copyAddress = async () => {
    await navigator.clipboard.writeText(
      profile?.addressChecksummed ?? entry.accountAddress,
    );
    setTooltip("Address copied!");
    setTimeout(() => setTooltip("Click to copy address"), 2_000);
  };

  return (
    <article
      data-testid={dataTestId}
      className={`rounded-lg bg-white shadow-none ${isYou ? "border" : "border-none"}`}
    >
      <div className="flex justify-between gap-3 py-2 pr-3 pl-2 text-subtitle1 max-md:flex-col">
        <div className="flex flex-1 items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-100 md:h-16 md:w-16">
            {profile?.primaryAvatarUrl ? (
              <img
                data-testid="entry-avatar"
                src={profile.primaryAvatarUrl}
                alt=""
              />
            ) : (
              <span aria-hidden>
                {entry.accountAddress.slice(2, 4).toUpperCase()}
              </span>
            )}
          </div>
          <button
            data-testid="entry-name"
            title={tooltip}
            className="cursor-pointer tabular-nums"
            onClick={copyAddress}
          >
            {profile?.primaryName ??
              profile?.addressTruncated ??
              entry.accountAddress}
          </button>
          {isYou && (
            <span
              data-testid="your-leaderboard-entry-badge"
              className="badge badge-light"
            >
              It&apos;s you
            </span>
          )}
        </div>
        <div className="flex gap-1 max-sm:flex-col max-md:text-subtitle4 sm:gap-4">
          <div className="flex items-center gap-1">
            <span className="text-alto">Rank:</span>
            <span data-testid="entry-rank">#{entry.rank}</span>
          </div>
          <hr className="w-9 max-sm:hidden" />
          <div className="flex w-[250px] items-center">
            <span className="text-alto">Flow rate:</span>
            <span
              data-testid="entry-flow-rate-value"
              className="whitespace-nowrap"
            >
              &nbsp;{formatMonthlyFlowRate(BigInt(entry.flowRate))} SUP/mo
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
