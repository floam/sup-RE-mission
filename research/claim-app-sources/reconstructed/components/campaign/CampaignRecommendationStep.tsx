"use client";

import Link from "next/link";

import type { ProgramApp } from "../../types/program-app";
import { APP_ONBOARDING_CONFIG } from "../apps/AppOnboardingModal";
import { AppModalProvider } from "../apps/AppOptionsModal";
import { ProgramAppCard } from "../apps/ProgramAppCard";

export function CampaignRecommendationStep({
  app,
  onClose,
}: {
  app: ProgramApp;
  onClose(): void;
}) {
  const hasOnboarding = Boolean(APP_ONBOARDING_CONFIG[app.appId]);
  return (
    <AppModalProvider apps={[app]}>
      {({ openAppModal }) => (
        <div className="flex h-full flex-col rounded-xl bg-[#E9E9E9] p-6">
          <div className="mb-6 flex flex-col gap-1">
            <span className="text-base text-black uppercase">
              Recommended Campaign
            </span>
            <span className="text-green text-h7">Earn More SUP!</span>
          </div>
          <ProgramAppCard app={app} hideCTA className="flex-1" />
          <div className="mt-6 flex flex-col gap-3">
            {hasOnboarding ? (
              <button
                data-testid="recommendation-app-cta-button"
                className="button button-outline w-full rounded-xl"
                onClick={() => openAppModal(app.appId)}
              >
                {app.cta}
              </button>
            ) : (
              <Link
                data-testid="recommendation-app-cta-button"
                className="button button-outline w-full rounded-xl"
                href={app.url}
                target="_blank"
              >
                {app.cta}
              </Link>
            )}
            <button
              data-testid="recommendation-maybe-later-button"
              className="w-full rounded-xl"
              onClick={onClose}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </AppModalProvider>
  );
}
