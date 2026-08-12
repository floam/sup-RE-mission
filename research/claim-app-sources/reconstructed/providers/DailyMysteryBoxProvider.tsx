"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWaitForTransactionReceipt } from "wagmi";

import { Countdown } from "../components/claim/Countdown";
import { TransactionButton } from "../components/TransactionButton";
import { APP_CHAIN } from "../config/chains";
import { useWalletAccount } from "../hooks/useWalletAccount";
import {
  checkMysteryBox,
  claimMysteryBoxPoints,
  readPendingMysteryBoxClaim,
  useMysteryBoxLastClaim,
  useMysteryBoxOpen,
  writePendingMysteryBoxClaim,
} from "../hooks/useMysteryBox";
import type {
  MysteryBoxResult,
  PendingMysteryBoxClaim,
} from "../types/campaign-rewards";

export function useDailyMysteryBox() {
  const { address, isConnected } = useWalletAccount();
  const queryClient = useQueryClient();
  const [openResult, setOpenResult] = useState<MysteryBoxResult | null>(null);
  const [pendingClaim, setPendingClaim] =
    useState<PendingMysteryBoxClaim | null>(null);
  const [claimCompleted, setClaimCompleted] = useState(false);
  const attemptedClaimHash = useRef<string | null>(null);
  const transaction = useMysteryBoxOpen(address);
  const lastClaim = useMysteryBoxLastClaim(address);

  useEffect(() => {
    attemptedClaimHash.current = null;
    setClaimCompleted(false);
    setOpenResult(null);
    const stored = readPendingMysteryBoxClaim(address);
    const recoverable =
      stored?.status === "claiming"
        ? { ...stored, status: "succeeded" as const }
        : stored;
    if (recoverable) writePendingMysteryBoxClaim(address, recoverable);
    setPendingClaim(recoverable);
  }, [address]);
  const savePendingClaim = (claim: PendingMysteryBoxClaim | null) => {
    setPendingClaim(claim);
    writePendingMysteryBoxClaim(address, claim);
  };
  const check = useQuery({
    queryKey: ["dailyMysteryBox", address],
    queryFn: async () => {
      const result = await checkMysteryBox(address!);
      if (!result.success)
        throw new Error(result.error ?? "Failed to check mystery-box eligibility");
      return result;
    },
    enabled: Boolean(address && isConnected && !claimCompleted),
    refetchOnWindowFocus: false,
    retry: 3,
  });
  const resumedClaim = Boolean(
    pendingClaim &&
    pendingClaim.address === address &&
    pendingClaim.txHash !== transaction.txHash,
  );
  const resumedReceipt = useWaitForTransactionReceipt({
    chainId: APP_CHAIN.id,
    hash: resumedClaim ? pendingClaim?.txHash : undefined,
    query: {
      enabled: Boolean(resumedClaim && pendingClaim?.status === "pending"),
    },
  });
  const claim = useMutation({
    mutationKey: ["claimMysteryBoxPoints", address],
    mutationFn: ({
      address: claimAddress,
      transactionHash,
    }: {
      address: NonNullable<typeof address>;
      transactionHash: `0x${string}`;
    }) =>
      claimMysteryBoxPoints(claimAddress, transactionHash).then((result) => {
        if (!result.success)
          throw new Error(result.error ?? "Failed to claim mystery-box points");
        return result;
      }),
    retry: 3,
    onSuccess: (result) => {
      transaction.reset();
      setOpenResult(result);
      if (result.success) {
        savePendingClaim(null);
        setClaimCompleted(true);
        void check.refetch();
        void lastClaim.refetch();
        void queryClient.invalidateQueries({
          queryKey: ["getAccountProgramPointStates", address],
          refetchType: "all",
        });
      } else {
        attemptedClaimHash.current = pendingClaim?.txHash ?? null;
        if (pendingClaim)
          savePendingClaim({ ...pendingClaim, status: "succeeded" });
        console.error(
          "Failed to claim mystery box points",
          result.error ?? "Unknown error",
        );
      }
    },
    onError: (error) => {
      console.error("Mystery box claim error:", error);
      attemptedClaimHash.current = null;
      if (pendingClaim)
        savePendingClaim({ ...pendingClaim, status: "succeeded" });
    },
  });

  useEffect(() => {
    if (
      transaction.txHash &&
      address &&
      !claimCompleted &&
      pendingClaim?.txHash !== transaction.txHash
    ) {
      savePendingClaim({
        txHash: transaction.txHash,
        address,
        status: "pending",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, claimCompleted, transaction.txHash]);
  useEffect(() => {
    if (
      transaction.isReverted &&
      transaction.txHash &&
      pendingClaim?.txHash === transaction.txHash
    )
      savePendingClaim(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingClaim, transaction.isReverted, transaction.txHash]);
  useEffect(() => {
    if (
      transaction.isFinished &&
      transaction.txHash &&
      address &&
      pendingClaim?.txHash === transaction.txHash &&
      pendingClaim.status === "pending"
    ) {
      savePendingClaim({ ...pendingClaim, status: "succeeded" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, pendingClaim, transaction.isFinished, transaction.txHash]);
  useEffect(() => {
    if (!resumedClaim) return;
    if (
      resumedReceipt.isSuccess &&
      resumedReceipt.data?.status === "success" &&
      pendingClaim?.status === "pending"
    )
      savePendingClaim({ ...pendingClaim, status: "succeeded" });
    if (
      resumedReceipt.isSuccess &&
      resumedReceipt.data?.status === "reverted"
    )
      savePendingClaim(null);
    if (resumedReceipt.isError) savePendingClaim(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pendingClaim,
    resumedClaim,
    resumedReceipt.isError,
    resumedReceipt.isSuccess,
    resumedReceipt.data?.status,
  ]);
  useEffect(() => {
    if (
      !address ||
      pendingClaim?.status !== "succeeded" ||
      pendingClaim.address !== address ||
      claimCompleted ||
      claim.isPending ||
      claim.isError ||
      attemptedClaimHash.current === pendingClaim.txHash
    )
      return;
    attemptedClaimHash.current = pendingClaim.txHash;
    savePendingClaim({ ...pendingClaim, status: "claiming" });
    claim.mutate({ address, transactionHash: pendingClaim.txHash });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, claim.isError, claim.isPending, claimCompleted, pendingClaim]);

  const canClaim = Boolean(
    address &&
    isConnected &&
    check.data?.success &&
    check.data.shouldShow &&
    !claimCompleted &&
    !check.isLoading,
  );
  const isOnCooldown = Boolean(
    check.data?.success &&
    check.data.shouldShow === false &&
    Number(lastClaim.data ?? 0n) > 0,
  );
  const claimIsFinishing =
    claim.isPending ||
    (resumedClaim &&
      (resumedReceipt.isFetching || pendingClaim?.status === "succeeded"));
  return {
    canClaim,
    isOnCooldown,
    mysteryBoxData: check.data?.success ? check.data : null,
    isLoading: check.isLoading,
    handleOpenBox() {
      if (address && !transaction.status?.isLoading) transaction.open();
    },
    retryRewardClaim() {
      if (
        !address ||
        claim.isPending ||
        pendingClaim?.address !== address ||
        pendingClaim.status !== "succeeded"
      )
        return;
      attemptedClaimHash.current = pendingClaim.txHash;
      savePendingClaim({ ...pendingClaim, status: "claiming" });
      claim.mutate({ address, transactionHash: pendingClaim.txHash });
    },
    openResult,
    status: claimIsFinishing
      ? {
          displayText: "Opening mystery box...",
          isLoading: true,
          isError: false,
          isFinished: false,
        }
      : transaction.status,
    chain: APP_CHAIN,
    hasSupStakingBonus: Boolean(
      check.data?.success && check.data.hasSupStakingBonus,
    ),
    lastClaimTime: Number(lastClaim.data ?? 0n),
    async refetchEligibility() {
      setClaimCompleted(false);
      await transaction.simulateMysteryBoxOpen.refetch();
      await Promise.all([check.refetch(), lastClaim.refetch()]);
    },
  };
}

export function DailyMysteryBoxClaim() {
  const mysteryBox = useDailyMysteryBox();
  if (!mysteryBox.mysteryBoxData) return null;

  const amount = mysteryBox.openResult?.supPerMonth ?? 0;
  return (
    <section className="mystery-box-claim" aria-label="Daily SUP Mystery Box">
      <div className="mystery-box-copy">
        <strong>daily mystery box</strong>
        {mysteryBox.openResult?.success ? (
          <span className="positive">
            won ~{amount.toLocaleString()} SUP/mo
            {mysteryBox.openResult.isRareRoll ? " · rare jackpot" : ""}
          </span>
        ) : mysteryBox.openResult?.success === false ? (
          <span role="alert">
            The box opened, but the reward claim did not finish.
          </span>
        ) : mysteryBox.isOnCooldown ? (
          <span>
            next claim in{" "}
            <Countdown
              targetDate={
                new Date((mysteryBox.lastClaimTime + 86_400) * 1_000)
              }
              onComplete={mysteryBox.refetchEligibility}
            />
          </span>
        ) : (
          <span>
            {mysteryBox.mysteryBoxData.activePrograms} active program
            {mysteryBox.mysteryBoxData.activePrograms === 1 ? "" : "s"} ·
            0.0001 ETH
          </span>
        )}
      </div>

      {mysteryBox.openResult?.success === false ? (
        <button
          className="mystery-box-claim-button"
          type="button"
          disabled={Boolean(mysteryBox.status?.isLoading)}
          onClick={mysteryBox.retryRewardClaim}
        >
          {mysteryBox.status?.isLoading ? "[ retrying… ]" : "[ retry claim ]"}
        </button>
      ) : !mysteryBox.openResult?.success ? (
        <TransactionButton
          chain={mysteryBox.chain}
          onClick={mysteryBox.handleOpenBox}
          status={mysteryBox.status}
          ButtonProps={{
            className: "mystery-box-claim-button",
            disabled: !mysteryBox.canClaim,
            type: "button",
          }}
        >
          [ claim mystery box ]
        </TransactionButton>
      ) : null}
      {mysteryBox.hasSupStakingBonus && !mysteryBox.openResult && (
        <small>SUP staking bonus: 2× rewards</small>
      )}
    </section>
  );
}
