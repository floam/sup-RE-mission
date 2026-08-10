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
  const [copied, setCopied] = useState(false);
  const copyAddress = async () => {
    await navigator.clipboard.writeText(
      profile?.addressChecksummed ?? entry.accountAddress,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };
  const label =
    profile?.primaryName ?? profile?.addressTruncated ?? entry.accountAddress;

  return (
    <p data-testid={dataTestId} className="leaderboard-line">
      <span data-testid="entry-rank">#{entry.rank}</span>{" "}
      <button
        data-testid="entry-name"
        title={copied ? "Address copied" : "Copy address"}
        type="button"
        onClick={copyAddress}
      >
        {label}
      </button>{" "}
      <span data-testid="entry-flow-rate-value">
        {formatMonthlyFlowRate(BigInt(entry.flowRate))} SUP/mo
      </span>
      {isYou && (
        <span data-testid="your-leaderboard-entry-badge" className="positive">
          {" "}you
        </span>
      )}
    </p>
  );
}
