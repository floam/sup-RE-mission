"use client";

import { format } from "date-fns";
import { Info } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import { formatTokenAmount, SUP_SYMBOL } from "../../lib/format";
import type { ProgramApp } from "../../types/program-app";
import { APP_ONBOARDING_CONFIG } from "./AppOnboardingModal";

export interface ProgramAppCardProps {
  app: ProgramApp;
  className?: string;
  forceSmallLayout?: boolean;
  hideCoverSection?: boolean;
  hideCTA?: boolean;
  onClick?(): void;
}

export function ProgramAppCard(props: ProgramAppCardProps) {
  const { app } = props;
  const isExpired = app.isExpired ?? false;
  const hasProgram = app.program !== undefined;
  const isFinished = app.program?.onchainInfo?.isFundingFinished ?? false;
  const hasOnboarding = useMemo(
    () => Boolean(APP_ONBOARDING_CONFIG[app.appId]),
    [app.appId],
  );
  const totalAllocated =
    app.program?.onchainInfo?.totalAllocated || app.totalAllocatedHint || 0n;

  return (
    <article
      className={`rounded-lg p-4 ${props.className ?? ""} ${isFinished || isExpired ? "opacity-75" : ""}`}
    >
      <div
        data-testid={`${app.name}-card`}
        className={`flex h-full gap-4 ${props.forceSmallLayout ? "flex-col" : "max-lg:flex-col"}`}
      >
        <div className="flex flex-1 flex-col justify-between gap-5">
          <div data-testid="app-image" className="flex items-center gap-2">
            <Image
              src={app.logoUrl}
              alt="Logo"
              width={60}
              height={60}
              className={`rounded-md ${hasProgram ? "" : "grayscale"}`}
            />
            <div className="flex flex-col gap-1">
              <span
                data-testid="app-name"
                className={`text-title2 ${hasProgram ? "" : "text-alto"}`}
              >
                {app.name}
              </span>
              <span
                data-testid="campaign-end-time"
                className="text-caption1 text-purple"
              >
                {isExpired
                  ? "Campaign expired"
                  : isFinished
                    ? "Campaign completed"
                    : app.program?.onchainInfo.fundingEndDate
                      ? `Campaign ends: ${format(Number(app.program.onchainInfo.fundingEndDate) * 1_000, "d\tLLL yyyy")}`
                      : "Campaign currently inactive"}
              </span>
            </div>
          </div>
          <p
            data-testid="app-description"
            className={`flex-1 text-base ${hasProgram ? "" : "text-alto"}`}
          >
            {app.longDescription || app.description}
          </p>
          {app.program?.sharedAllocation ? (
            <div className="flex items-center gap-3">
              <hr className="flex-1" />
              <span
                className="badge badge-light flex gap-1"
                title={`Shared rewards pool with the ${app.category} campaign.`}
              >
                Shared allocation <Info size={12} />
              </span>
              <hr className="flex-1" />
            </div>
          ) : (
            <hr />
          )}
          <div className="flex gap-4">
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-caption1">{SUP_SYMBOL} Allocated:</span>
              <span
                data-testid="sup-allocated"
                className={totalAllocated ? "text-title3" : "text-title4"}
              >
                {totalAllocated
                  ? formatTokenAmount(totalAllocated)
                  : "Coming soon"}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-caption1">{SUP_SYMBOL} Claimed:</span>
              <span data-testid="sup-claimed" className="text-title3">
                {app.program?.onchainInfo?.totalClaimed !== undefined
                  ? formatTokenAmount(app.program.onchainInfo.totalClaimed)
                  : "N/A"}
              </span>
            </div>
          </div>
        </div>
        {!props.hideCoverSection && (
          <div
            className={`w-full ${props.forceSmallLayout ? "" : "lg:w-[240px]"}`}
          >
            <div
              className={`relative w-full rounded-lg pb-[100%] ${app.bgColor === "#0400F5" ? "bg-[#0400F5]" : ""} ${app.bgColor === "#000000" ? "bg-black" : ""}`}
            >
              <Image
                data-testid="app-big-image"
                src={app.coverUrl}
                alt={app.name}
                fill
                className={`z-[1] rounded-md object-cover ${hasProgram ? "" : "grayscale"}`}
              />
              {!props.hideCTA &&
                (hasOnboarding || !hasProgram || isExpired ? (
                  <button
                    data-testid="app-button"
                    className="absolute bottom-3 left-3 z-[2] w-[calc(100%-24px)]"
                    disabled={!hasProgram || isExpired}
                    onClick={props.onClick}
                  >
                    {isExpired
                      ? "Expired"
                      : hasProgram
                        ? app.cta
                        : "Coming soon"}
                  </button>
                ) : (
                  <Link
                    data-testid="app-button"
                    className="button absolute bottom-3 left-3 z-[2] w-[calc(100%-24px)]"
                    href={app.url}
                    target="_blank"
                  >
                    {app.cta}
                  </Link>
                ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
