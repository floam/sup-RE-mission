"use client";

import { format } from "date-fns";
import { ArrowLeft, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import type { ProgramApp } from "../../types/program-app";

interface OnboardingStep {
  label: string;
  title: string;
  description: ReactNode;
  image: string;
}

interface AppOnboarding {
  level: 1 | 2 | 3;
  budget: number;
  steps: OnboardingStep[];
}

const superBoring = (
  networks: string,
  includeStaking = true,
): AppOnboarding => ({
  level: 1,
  budget: 30,
  steps: [
    {
      label: "Select token pair",
      title: "Token pair",
      description: `Choose any token pair on ${networks} to start your DCA.`,
      image: "/app-onboarding/superboring-step-1.png",
    },
    {
      label: "Setup DCA",
      title: "Invest and chill",
      description:
        "Your trade is split into small, automated swaps over time—reducing volatility and optimizing your entry price effortlessly.",
      image: "/app-onboarding/superboring-step-2.png",
    },
    ...(includeStaking
      ? [
          {
            label: "Stake BORING (optional)",
            title: "Stake",
            description:
              "For each DCA position you earn BORING token you can stake and earn additional income!",
            image: "/app-onboarding/superboring-step-3.png",
          },
        ]
      : []),
  ],
});

const givethCurrent: AppOnboarding = {
  level: 1,
  budget: 20,
  steps: [
    {
      label: "Find project",
      title: "Explore projects",
      description:
        "Browse a wide range of initiatives including social impact, environmental change, and open source development.",
      image: "/app-onboarding/giveth-step-1.png",
    },
    {
      label: "Recurring donation",
      title: "Donate",
      description: (
        <>
          Select the &quot;Recurring Donation&quot; feature, specify the token
          and amount and start a stream by clicking &quot;Donate&quot;.
          <br />
          <br />
          Remember: You&apos;ll only earn SUP for active streams to eligible
          projects!
        </>
      ),
      image: "/app-onboarding/giveth-step-2.png",
    },
  ],
};

const goodBuilders: AppOnboarding = {
  level: 3,
  budget: 10,
  steps: [
    {
      label: "Join GoodDollar",
      title: "Claim Your Votes",
      description: "Claim your first 10 votes by joining GoodDollar.",
      image: "/app-onboarding/GoodBuilders-Step-1.png",
    },
    {
      label: "Build Your Ballot",
      title: "Vote for Builders",
      description:
        "Add your favorite GoodBuilders to your ballot & submit it onchain.",
      image: "/app-onboarding/GoodBuilders-Step-2.png",
    },
    {
      label: "Share & Earn",
      title: "Grow & Share",
      description:
        '"Grow the Pie" and/or share your participation on X, Farcaster, & Lens for SUP bonuses.',
      image: "/app-onboarding/GoodBuilders-Step-3.png",
    },
  ],
};

const beamr: AppOnboarding = {
  level: 1,
  budget: 10,
  steps: [
    {
      label: "Add the mini app",
      title: "Beamr",
      description:
        "Add the Beamr mini app to your Farcaster account & enable notifications",
      image: "/app-onboarding/beamr-step-1.png",
    },
    {
      label: "Open a Beamr",
      title: "Engage",
      description:
        "Start a BEAMR token stream to your dynamic distribution pool",
      image: "/app-onboarding/beamr-step-2.png",
    },
    {
      label: "Engage",
      title: "Earn more SUP",
      description: "Engage, share, grow, and use Beamr to earn SUP",
      image: "/app-onboarding/beamr-step-3.png",
    },
  ],
};

const banger: AppOnboarding = {
  level: 2,
  budget: 10,
  steps: [
    {
      label: "Deposit BANGER 🔥",
      title: "Deposit BANGER 🔥",
      description:
        "Deposit BANGER 🔥 to your vault in the Banger miniapp, to be able to bet on viral posts and earn SUP.",
      image: "/app-onboarding/banger-onboarding-step-1.png",
    },
    {
      label: "Create or Join a Banger",
      title: "Create or Join a Banger",
      description:
        "You can bet on viral posts by tagging @betonbangers bot on Farcaster or do it directly from the Banger app. Each banger you create or join earns SUP.",
      image: "/app-onboarding/banger-onboarding-step-2.png",
    },
  ],
};

const flowStateCouncil: AppOnboarding = {
  level: 1,
  budget: 1,
  steps: [
    {
      label: "Find round",
      title: "Explore",
      description: "Select an active Flow Council or Flow Guild funding round.",
      image: "/app-onboarding/flow-state-s5-step-1.png",
    },
    {
      label: "Fund",
      title: "Grow the Pie",
      description: "Open a funding flow that's split to builders in real-time.",
      image: "/app-onboarding/flow-state-s5-step-2.png",
    },
    {
      label: "Launch",
      title: "Community SUP",
      description:
        "Launch & fund your own verified Flow Council round to earn SUP for your community.",
      image: "/app-onboarding/flow-state-s5-step-3.png",
    },
  ],
};

/** Exact app IDs, difficulty, budgets, step text, and asset URLs from webpack 21772. */
export const APP_ONBOARDING_CONFIG: Record<string, AppOnboarding> = {
  "s2-alfafrens": {
    level: 1,
    budget: 15,
    steps: [
      {
        label: "Onboard to AlfaFrens",
        title: "Onboard to AlfaFrens",
        description:
          "Join AlfaFrens and complete the quick onboarding process.",
        image: "/app-onboarding/alfafrens-step-1.png",
      },
      {
        label: "Subscribe to channel",
        title: "Subscribe",
        description:
          "Subscribe to any channel of your choice for exclusive chat access and earn AF and SUP!",
        image: "/app-onboarding/alfafrens-step-2.png",
      },
    ],
  },
  "s2-superboring": superBoring("Base or Optimism"),
  "s2-superboring-2nd-wave": superBoring("Arbitrum", false),
  "s2-giveth": {
    level: 1,
    budget: 19,
    steps: [
      {
        label: "Find project",
        title: "Explore projects",
        description: "Pick any of the causes, and Donate on Base or Optimism.",
        image: "/app-onboarding/giveth-step-1.png",
      },
      {
        label: "Recurring donation",
        title: "Donate",
        description: (
          <>
            Select the “Recurring Donation” feature, specify the token and
            amount and start a stream by clicking “Donate”.
            <br />
            <br />
            Remember: You’ll only earn SUP for active streams!
          </>
        ),
        image: "/app-onboarding/giveth-step-2.png",
      },
    ],
  },
  "s2-flow-state": {
    level: 2,
    budget: 10,
    steps: [
      {
        label: "Select",
        title: "Round selection",
        description: "Scroll down and select an active round.",
        image: "/app-onboarding/flow-state-step-1.png",
      },
      {
        label: "Grow the pie",
        title: "Grow the pie",
        description:
          "Click “Grow the pie” to distribute your donation between different projects.",
        image: "/app-onboarding/flow-state-step-2.png",
      },
      {
        label: "...or donate",
        title: "Donate",
        description: "You can also select one project you want to donate to.",
        image: "/app-onboarding/flow-state-step-3.png",
      },
    ],
  },
  "s2-flow-state-farcaster": {
    level: 2,
    budget: 10,
    steps: [
      {
        label: "Add Flow Caster",
        title: "Connect Flow Caster to Farcaster",
        description:
          "Add the Flow Caster mini app to your Farcaster account & enable notifications.",
        image: "/app-onboarding/FSonFC-Step-1.png",
      },
      {
        label: "Start a Stream",
        title: "Stream to Builders",
        description:
          "Start a Superfluid stream that's split to dozens of builders in real-time.",
        image: "/app-onboarding/FSonFC-Step-2.png",
      },
      {
        label: "Share & Earn",
        title: "Share Flow Caster for Bonuses",
        description: "Share Flow Caster in your feed to earn SUP bonuses.",
        image: "/app-onboarding/FSonFC-Step-3.png",
      },
    ],
  },
  "s2-goodbuilders-flow-council": goodBuilders,
  "s2-gooddollar": {
    level: 1,
    budget: 10,
    steps: [
      {
        label: "Sign up",
        title: "Get G$",
        description:
          "Join the GoodDollar and complete the quick onboarding process.",
        image: "/app-onboarding/gooddollar-step-1.png",
      },
      {
        label: "Claim daily G$",
        title: "Claim",
        description: "Remember to come back daily to claim your G$",
        image: "/app-onboarding/gooddollar-step-2.png",
      },
    ],
  },
  "s2-activation-rewards": {
    level: 1,
    budget: 10,
    steps: [
      {
        label: "Connect and Mint",
        title: "Connect and Mint",
        description:
          "Connect you wallet, select your favourite network and mint Superfluid Ecosystem Rewards Pass!",
        image: "/app-onboarding/activation-rewards-step-1.png",
      },
    ],
  },
  "s3-community-activations": {
    level: 1,
    budget: 10,
    steps: [
      {
        label: "Connect and Mint",
        title: "Connect and Mint",
        description:
          "Connect your wallet, select your favourite network and mint Superfluid Ecosystem Rewards Pass!",
        image: "/app-onboarding/activation-rewards-step-1.png",
      },
      {
        label: "Participate",
        title: "Join the Community",
        description:
          "Engage on Discord and Farcaster, participate in marketing and community activations to qualify for rewards.",
        image: "/app-onboarding/activation-rewards-step-2.png",
      },
    ],
  },
  "s3-banger": banger,
  "s3-superboring": superBoring("Base, Arbitrum, or Optimism"),
  "s3-giveth": givethCurrent,
  "s3-gooddollar": goodBuilders,
  "s3-beamr": beamr,
  "s3-flowstate": {
    level: 1,
    budget: 10,
    steps: [
      {
        label: "Add the mini app",
        title: "Enable notifications",
        description:
          "Add the Flow Caster mini app to your Farcaster account & enable notifications",
        image: "/app-onboarding/flowcaster-step-1.png",
      },
      {
        label: "Donate",
        title: "Support builders",
        description:
          "Open a stream that's dynamically split to builders in real-time",
        image: "/app-onboarding/flowcaster-step-2.png",
      },
      {
        label: "Share",
        title: "Earn more SUP",
        description: "Share Flow Caster in your feed to earn SUP bonuses",
        image: "/app-onboarding/flowcaster-step-3.png",
      },
    ],
  },
  "s5-superboring": superBoring("Base, Arbitrum, or Optimism"),
  "s5-banger": banger,
  "s5-giveth": givethCurrent,
  "s5-gooddollar": goodBuilders,
  "s5-beamr": beamr,
  "s5-flowstate": flowStateCouncil,
  "s6-superboring": superBoring("Base, Arbitrum, or Optimism"),
  "s6-giveth": givethCurrent,
  "s6-gooddollar": goodBuilders,
  "s6-flowstate": flowStateCouncil,
};

const DIFFICULTY = ["Easy", "Medium", "Hard"] as const;

export function AppOnboardingModal({
  app,
  open,
  onOpenChange,
}: {
  app: ProgramApp;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const onboarding = APP_ONBOARDING_CONFIG[app.appId];
  if (!onboarding || !open) return null;
  const step = onboarding.steps[stepIndex];
  const campaignStatus = app.isExpired
    ? "Campaign expired"
    : app.program?.onchainInfo?.isFundingFinished
      ? "Campaign completed"
      : app.program?.onchainInfo.fundingEndDate
        ? `Campaign ends: ${format(Number(app.program.onchainInfo.fundingEndDate) * 1_000, "d\tLLL yyyy")}`
        : "Campaign currently inactive";

  return (
    <div
      role="dialog"
      aria-label={app.name}
      className="modal max-h-screen w-[940px] max-w-full overflow-y-auto bg-platinum p-4 pt-8 md:min-h-[600px] md:p-8 md:pt-12"
    >
      <button aria-label="Close" onClick={() => onOpenChange(false)}>
        ×
      </button>
      <div className="flex items-start gap-5 max-md:flex-col">
        <aside className="w-full md:w-[43%]">
          <div className="flex flex-col gap-5 rounded-b-none p-4">
            <div className="flex items-center gap-2">
              <Image
                priority
                unoptimized
                src={app.logoUrl}
                alt="Logo"
                width={60}
                height={60}
                className="rounded-md"
              />
              <div className="flex flex-col gap-1">
                <span className="text-title2">{app.name}</span>
                <span className="text-caption1 text-purple">
                  {campaignStatus}
                </span>
              </div>
            </div>
            <p className="flex-1 text-base">{app.description}</p>
            <div className="mb-4 flex items-start gap-2">
              <span className="badge badge-gray flex h-5 items-center gap-2 rounded-full px-2 py-0 text-[12px]">
                <span className="flex gap-[2px]">
                  {[1, 2, 3].map((level) => (
                    <Star
                      key={level}
                      size={14}
                      className={
                        level <= onboarding.level ? "text-green" : "text-white"
                      }
                      fill={level <= onboarding.level ? "currentColor" : "none"}
                    />
                  ))}
                </span>
                <span className="uppercase">
                  {DIFFICULTY[onboarding.level - 1]}
                </span>
              </span>
              <span className="badge badge-gray h-5 rounded-full px-2 py-0 text-[12px] uppercase">
                min. volume streamed:{" "}
                <span className="text-green">${onboarding.budget}</span>
              </span>
            </div>
          </div>
          <div className="-mt-4 rounded-lg bg-green-pale px-5 py-6">
            <div className="mb-5 text-green text-title3">Steps</div>
            <div className="flex flex-col rounded-lg bg-white">
              {onboarding.steps.map((candidate, index) => (
                <button
                  key={candidate.label}
                  className="flex h-auto items-center gap-2 px-3 py-4 text-left"
                  onClick={() => setStepIndex(index)}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border border-green text-[10px] text-green ${index <= stepIndex ? "bg-green-pale/40" : ""}`}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={`font-medium text-base ${index > stepIndex ? "text-alto" : ""}`}
                  >
                    {candidate.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>
        <section className="flex h-full w-full flex-col p-3 text-center md:w-[57%]">
          <Image
            priority
            unoptimized
            src={step.image}
            alt={step.label}
            width={473}
            height={261}
            className="w-full rounded-lg border"
          />
          <div className="my-10 flex flex-1 flex-col gap-5">
            <h3 className="text-title1">{step.title}</h3>
            <p>{step.description}</p>
          </div>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                className="p-3"
                onClick={() => setStepIndex(stepIndex - 1)}
              >
                <ArrowLeft size={24} />
              </button>
            )}
            {stepIndex === onboarding.steps.length - 1 ? (
              <Link className="button flex-1" href={app.url} target="_blank">
                {app.cta}
              </Link>
            ) : (
              <button
                className="flex-1"
                onClick={() => setStepIndex(stepIndex + 1)}
              >
                Next
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
