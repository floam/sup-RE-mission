"use client";

import Link from "next/link";
import type { Chain } from "viem";

import type {
  ActivityTier,
  MysteryBoxResult,
} from "../../types/campaign-rewards";
import type { TransactionStatus } from "../../types/transactions";
import { TransactionButton } from "../TransactionButton";
import { CampaignProgress } from "./CampaignProgress";

export const ACTIVITY_TIERS: readonly ActivityTier[] = [
  {
    minPrograms: 1,
    tier: 1,
    name: "Beginner",
    normalRollMax: 50,
    rareRollMin: 500,
    rareRollMax: 2_500,
  },
  {
    minPrograms: 2,
    tier: 2,
    name: "Active",
    normalRollMax: 75,
    rareRollMin: 750,
    rareRollMax: 3_750,
  },
  {
    minPrograms: 3,
    tier: 3,
    name: "Engaged",
    normalRollMax: 100,
    rareRollMin: 1_000,
    rareRollMax: 5_000,
  },
  {
    minPrograms: 4,
    tier: 4,
    name: "Dedicated",
    normalRollMax: 125,
    rareRollMin: 1_250,
    rareRollMax: 6_250,
  },
  {
    minPrograms: 5,
    tier: 5,
    name: "Committed",
    normalRollMax: 150,
    rareRollMin: 1_500,
    rareRollMax: 7_500,
  },
  {
    minPrograms: 6,
    tier: 6,
    name: "Expert",
    normalRollMax: 175,
    rareRollMin: 1_750,
    rareRollMax: 8_750,
  },
  {
    minPrograms: 7,
    tier: 7,
    name: "Advanced",
    normalRollMax: 200,
    rareRollMin: 2_000,
    rareRollMax: 10_000,
  },
  {
    minPrograms: 8,
    tier: 8,
    name: "Elite",
    normalRollMax: 225,
    rareRollMin: 2_250,
    rareRollMax: 11_250,
  },
  {
    minPrograms: 9,
    tier: 9,
    name: "Master",
    normalRollMax: 250,
    rareRollMin: 2_500,
    rareRollMax: 12_500,
  },
  {
    minPrograms: 10,
    tier: 10,
    name: "Legendary",
    normalRollMax: 300,
    rareRollMin: 3_000,
    rareRollMax: 15_000,
  },
] as const;

export function getActivityTier(activePrograms: number) {
  const tier =
    ACTIVITY_TIERS.find(
      (candidate) => candidate.minPrograms === activePrograms,
    ) ?? ACTIVITY_TIERS.at(-1);
  const next = ACTIVITY_TIERS.find(
    (candidate) => candidate.minPrograms === activePrograms + 1,
  );
  return activePrograms === 0
    ? { tier: 0, name: "Inactive", next }
    : { ...tier!, next };
}

export function DailyMysteryBoxModal({
  open,
  onOpenChange,
  activePrograms,
  hasSupStakingBonus,
  onOpenBox,
  openResult,
  status,
  chain,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  activePrograms: number;
  hasSupStakingBonus: boolean;
  onOpenBox(): void;
  openResult: MysteryBoxResult | null;
  status?: TransactionStatus | null;
  chain: Chain;
}) {
  if (!open) return null;
  const activity = getActivityTier(activePrograms);
  if (openResult?.success) {
    const amount = openResult.supPerMonth ?? 0;
    const xText = `🎉 Just won ${amount} SUP/mo from the @Superfluid_HQ Mystery Box! ${openResult.isRareRoll ? "✨ RARE JACKPOT! ✨" : ""}}`;
    const farcasterText = `🎉 Just won ${amount} SUP/mo from the @superfluid Mystery Box! ${openResult.isRareRoll ? "✨ RARE JACKPOT! ✨" : ""}\nhttps://claim.superfluid.org`;
    return (
      <div
        role="dialog"
        aria-label="Mystery Box Result"
        className="modal max-w-md bg-[#E9E9E9] p-6"
      >
        <h2>Congratulations!</h2>
        {openResult.isRareRoll && (
          <strong data-testid="rare-jackpot-text">
            YOU HIT A RARE JACKPOT!
          </strong>
        )}
        <p data-testid="mystery-box-win-text">You won additional</p>
        <div data-testid="mystery-box-win-amount">
          ~{amount.toLocaleString()} SUP/mo
        </div>
        {openResult.isRareRoll && (
          <small>1 in {(10_000).toLocaleString()} chance!</small>
        )}
        {openResult.nextTierReward && (
          <p>
            You would have won ~{openResult.nextTierReward.toLocaleString()}{" "}
            SUP/mo if you were active in one more program.{" "}
            <Link href="/apps">Check out more campaigns here!</Link>
          </p>
        )}
        <h3>Share your win</h3>
        <a
          data-testid="share-x-button"
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(xText)}&url=${encodeURIComponent("https://claim.superfluid.org")}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Share on X
        </a>
        <a
          data-testid="share-farcaster-button"
          href={`https://warpcast.com/~/compose?text=${encodeURIComponent(farcasterText)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Share on Farcaster
        </a>
        <button
          data-testid="close-mystery-box-button"
          onClick={() => onOpenChange(false)}
        >
          Go claim your new SUP
        </button>
        <p>
          Come back tomorrow
          <br />
          for another daily mystery box!
        </p>
      </div>
    );
  }
  return (
    <div
      role="dialog"
      aria-label="Daily SUP Mystery Box"
      className="modal max-w-md bg-[#E9E9E9] p-6"
    >
      <button aria-label="Close" onClick={() => onOpenChange(false)}>
        ×
      </button>
      <h2>Daily SUP Mystery Box</h2>
      <p>Open your daily mystery box</p>
      <CampaignProgress
        activePrograms={activePrograms}
        nextTierName={activity.next?.name}
        nextTierMin={activity.next?.minPrograms}
      />
      {hasSupStakingBonus && (
        <p>
          <strong>SUPERFLUID GENESIS BONUS</strong>
          <br />
          Your staking bonus gives you double SUP rewards.
        </p>
      )}
      <p>
        Opening costs <strong>0.0001 ETH</strong>
      </p>
      <TransactionButton
        dataTestId="open-mystery-box-button"
        chain={chain}
        onClick={onOpenBox}
        status={status}
      >
        Open Mystery Box
      </TransactionButton>
      <details>
        <summary>Activity Tiers</summary>
        {ACTIVITY_TIERS.map((tier) => (
          <p key={tier.tier}>
            {tier.name} ({tier.minPrograms}) — Normal: 1-{tier.normalRollMax}{" "}
            SUP/mo; Rare: {tier.rareRollMin.toLocaleString()}-
            {tier.rareRollMax.toLocaleString()} SUP/mo
          </p>
        ))}
      </details>
    </div>
  );
}
