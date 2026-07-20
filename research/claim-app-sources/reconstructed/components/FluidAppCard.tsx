"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { useLocker } from "../contexts/LockerContext";
import {
  formatMonthlyFlowRate,
  formatTokenAmount,
  SUP_SYMBOL,
} from "../lib/format";
import { useProgramBalance } from "../hooks/useProgramBalance";
import { useProgramTotalFlowRate } from "../hooks/useProgramTotalFlowRate";
import type { ProgramApp } from "../types/program-app";
import { FlowingBalance } from "./FlowingBalance";

export function FluidAppCard({ programApp }: { programApp: ProgramApp }) {
  const { lockerAddress, accountAddress } = useLocker();
  const programId = programApp.program
    ? BigInt(programApp.program.id)
    : undefined;
  const { data: member } = useProgramBalance({ lockerAddress, programId });
  const { totalFlowRate } = useProgramTotalFlowRate(programId);
  const appUrl = useMemo(() => new URL(programApp.url), [programApp.url]);
  const info = programApp.program?.onchainInfo;

  // Logical OR is intentional and behavior-significant: an onchain zero falls
  // back to the CMS hint. Nullish coalescing would not match production.
  const totalAllocated =
    info?.totalAllocated || programApp.totalAllocatedHint || 0n;
  const totalClaimed = info?.totalClaimed ?? 0n;
  const claimedTimestamp = info?.totalClaimedTimestamp ?? 0;
  const fundingFlowRate = info?.fundingFlowRate ?? 0n;
  const isFinished = info?.isFundingFinished ?? false;
  const isExpired = programApp.isExpired ?? false;

  const distribution = useMemo(() => {
    if (!totalAllocated) return { percentage: 0, message: <span>N/A</span> };
    const percentage =
      totalClaimed > 0n
        ? Math.max(
            1,
            Number(
              (((1_000_000_000n * totalClaimed) / totalAllocated) * 100n) /
                1_000_000_000n,
            ),
          )
        : 0;
    return {
      percentage,
      message: (
        <>
          <FlowingBalance
            balance={totalClaimed}
            balanceTimestamp={claimedTimestamp}
            flowRate={isFinished ? 0n : fundingFlowRate}
            maxBalance={totalAllocated}
            dataTestId="program-total-claimed-flowing"
            decimalPlaces={2}
          />{" "}
          {SUP_SYMBOL} of {formatTokenAmount(totalAllocated)} {SUP_SYMBOL}
        </>
      ),
    };
  }, [
    claimedTimestamp,
    fundingFlowRate,
    isFinished,
    totalAllocated,
    totalClaimed,
  ]);

  return (
    <article
      data-testid={`${programApp.name}-row`}
      className={`rounded-lg border-none bg-white p-3 shadow-sm ${
        !programApp.program ? "opacity-60" : ""
      } ${isFinished || isExpired ? "opacity-75" : ""}`}
    >
      <div
        className="grid gap-4 max-md:flex max-md:flex-col md:items-center"
        style={{
          gridTemplateColumns: `2fr 0.75fr 1fr 2fr${accountAddress ? " 1fr" : ""} 120px`,
        }}
      >
        <div
          data-testid="program-name-and-image"
          className="flex items-center gap-3"
        >
          <img
            src={programApp.logoUrl}
            alt=""
            className="h-14 w-14 rounded-md shadow-md"
          />
          <div className="flex flex-col gap-2">
            <div
              data-testid="program-name"
              className="font-medium text-subtitle3"
            >
              {programApp.name}
            </div>
            <div
              data-testid="program-description"
              className="text-caption2 text-muted-foreground"
            >
              {programApp.description}
            </div>
          </div>
        </div>
        <div data-testid="program-category" className="text-sm max-md:hidden">
          {programApp.category}
        </div>
        <div className="text-sm max-md:flex">
          <span className="flex-1 font-medium md:hidden">Total Flowrate</span>
          <span data-testid="program-total-flowrate">
            {formatMonthlyFlowRate(totalFlowRate ?? 0n)} {SUP_SYMBOL}/mo
          </span>
        </div>
        <div>
          <span className="flex-1 font-medium md:hidden">
            {SUP_SYMBOL} Distributed
          </span>
          <div className="flex flex-col gap-2">
            <div
              className="flex items-center gap-2 text-sm"
              data-testid="program-sup-distributed"
            >
              {distribution.message}
              {programApp.program?.sharedAllocation && (
                <span
                  className="badge badge-light flex gap-1"
                  title={`Shared rewards pool with the ${programApp.category} campaign.`}
                >
                  Shared <Info size={12} />
                </span>
              )}
            </div>
            <progress
              className="h-2.5 w-[75%]"
              value={distribution.percentage}
              max={100}
            />
          </div>
        </div>
        <div className="text-sm max-md:flex md:hidden">
          <span className="flex-1 font-medium">Category</span>
          <span data-testid="mobile-program-category">
            {programApp.category}
          </span>
        </div>
        {accountAddress && (
          <div className="font-medium text-sm max-md:flex">
            <span className="flex-1 md:hidden">You Earned</span>
            <FlowingBalance
              dataTestId="program-you-earned"
              balance={member?.balance ?? 0n}
              flowRate={member?.flowRate ?? 0n}
              balanceTimestamp={member?.timestamp ?? 0n}
            />
            &nbsp;{SUP_SYMBOL}
          </div>
        )}
        {isExpired ? (
          <button disabled>Expired</button>
        ) : programApp.program ? (
          <Link
            data-testid="program-link"
            href={appUrl}
            target="_blank"
            className="button"
          >
            {isFinished ? "Completed" : "Open App"}
          </Link>
        ) : (
          <button disabled>Coming soon</button>
        )}
      </div>
    </article>
  );
}
