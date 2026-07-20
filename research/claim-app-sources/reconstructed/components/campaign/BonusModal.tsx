"use client";

import confetti from "canvas-confetti";
import { useEffect } from "react";

import type { BonusClaimResult } from "../../types/campaign-rewards";

export function BonusModal({
  open,
  onOpenChange,
  onClaimBonus,
  claimResult,
  isClaimPending,
  supPerMonth,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  onClaimBonus(): void;
  claimResult: BonusClaimResult | null;
  isClaimPending: boolean;
  supPerMonth: number;
}) {
  useEffect(() => {
    if (claimResult?.success)
      void confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#22c55e", "#10b981", "#34d399"],
      });
  }, [claimResult?.success]);
  if (!open) return null;
  if (claimResult?.success) {
    const amount = claimResult.supPerMonth?.toLocaleString();
    const farcasterUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(`Just claimed my ${amount} SUP/mo from the Intract Quest on @superfluid! Time to supercharge my rewards! 🚀\nhttps://claim.superfluid.org`)}`;
    const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(`Just claimed my ${amount} SUP/mo from the Intract Quest on @Superfluid_HQ! Time to supercharge my rewards! 🚀`)}&url=${encodeURIComponent("https://claim.superfluid.org")}`;
    return (
      <div
        role="dialog"
        aria-label="Quest Bonus Claimed Successfully"
        className="modal max-w-md bg-[#E9E9E9] p-6"
      >
        <h2>Congratulations!</h2>
        <p>YOU WON {amount} SUP/mo FROM Intract QUEST!</p>
        <h3>SHARE YOUR WIN</h3>
        <a href={farcasterUrl} target="_blank" rel="noopener noreferrer">
          Share on Farcaster
        </a>
        <a href={xUrl} target="_blank" rel="noopener noreferrer">
          Share on X
        </a>
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    );
  }
  return (
    <div
      role="dialog"
      aria-label="Quest Bonus"
      className="modal max-w-md bg-[#E9E9E9] p-6"
    >
      <h1>Claim Your Intract Quest Reward!</h1>
      <p>
        Congratulations! You&apos;ve successfully completed the Intract Quest
        and earned <strong>{supPerMonth.toLocaleString()} SUP/mo</strong> added
        to your stream!
      </p>
      <button onClick={onClaimBonus} disabled={isClaimPending}>
        {isClaimPending
          ? "Claiming Reward..."
          : `Claim ${supPerMonth.toLocaleString()} SUP/mo`}
      </button>
    </div>
  );
}
