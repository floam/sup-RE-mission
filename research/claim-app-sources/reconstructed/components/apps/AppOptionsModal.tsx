"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useState, type ReactNode } from "react";

import type { ProgramApp } from "../../types/program-app";
import { AppOnboardingModal } from "./AppOnboardingModal";

function AppOptionsModal({
  app,
  open,
  onOpenChange,
  openOnboarding,
}: {
  app: ProgramApp;
  open: boolean;
  onOpenChange(open: boolean): void;
  openOnboarding(): void;
}) {
  if (!open) return null;
  return (
    <div role="dialog" aria-label={app.name} className="modal">
      <button aria-label="Close" onClick={() => onOpenChange(false)}>
        ×
      </button>
      <div
        className={`relative mb-4 w-full rounded-lg pb-[100%] sm:mb-6 ${app.bgColor === "#0400F5" ? "bg-[#0400F5]" : ""} ${app.bgColor === "#000000" ? "bg-black" : ""}`}
      >
        <Image
          priority
          unoptimized
          src={app.coverUrl}
          alt={app.name}
          fill
          className="z-[1] rounded-md object-cover"
        />
      </div>
      <div className="flex flex-col gap-3">
        <button data-testid="how-to-earn-button" onClick={openOnboarding}>
          How to earn
        </button>
        <Link
          data-testid="open-app-button"
          className="button button-outline"
          href={app.url}
          target="_blank"
        >
          Open App
        </Link>
      </div>
    </div>
  );
}

export function AppModalProvider({
  apps,
  children,
}: {
  apps: ProgramApp[];
  children(input: { openAppModal(appId: string): void }): ReactNode;
}) {
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const app = apps.find((candidate) => candidate.appId === selectedAppId);
  const clearAfterAnimation = () =>
    setTimeout(() => setSelectedAppId(null), 300);

  return (
    <Fragment>
      {children({
        openAppModal: (appId) => {
          setSelectedAppId(appId);
          setOptionsOpen(true);
        },
      })}
      {app && (
        <AppOptionsModal
          app={app}
          open={optionsOpen}
          onOpenChange={(open) => {
            setOptionsOpen(open);
            if (!open) clearAfterAnimation();
          }}
          openOnboarding={() => {
            setOptionsOpen(false);
            setOnboardingOpen(true);
          }}
        />
      )}
      {app && (
        <AppOnboardingModal
          app={app}
          open={onboardingOpen}
          onOpenChange={(open) => {
            setOnboardingOpen(open);
            if (!open) clearAfterAnimation();
          }}
        />
      )}
    </Fragment>
  );
}
