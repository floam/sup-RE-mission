"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWaitForTransactionReceipt } from "wagmi";

import { DailyMysteryBoxModal } from "../components/campaign/DailyMysteryBoxModal";
import { Countdown } from "../components/claim/Countdown";
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
  const [showModal, setShowModal] = useState(false);
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
    queryFn: () => checkMysteryBox(address!),
    enabled: Boolean(address && isConnected && !claimCompleted),
    refetchOnWindowFocus: false,
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
    }) => claimMysteryBoxPoints(claimAddress, transactionHash),
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
    if (resumedReceipt.isSuccess && pendingClaim?.status === "pending")
      savePendingClaim({ ...pendingClaim, status: "succeeded" });
    if (resumedReceipt.isError) savePendingClaim(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pendingClaim,
    resumedClaim,
    resumedReceipt.isError,
    resumedReceipt.isSuccess,
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
    !showModal &&
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
    showModal,
    setShowModal,
    closeModal(open: boolean) {
      if (!open) {
        setShowModal(false);
        setOpenResult(null);
        transaction.reset();
      }
    },
    openModal() {
      setShowModal(true);
    },
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
    refetchEligibility() {
      setClaimCompleted(false);
      void check.refetch();
      void lastClaim.refetch();
    },
  };
}

export function DailyMysteryBoxProvider() {
  const mysteryBox = useDailyMysteryBox();
  return (
    <>
      {mysteryBox.mysteryBoxData && (
        <button
          className="mystery-box-launcher"
          onClick={mysteryBox.openModal}
          disabled={!mysteryBox.canClaim}
          aria-label={
            mysteryBox.canClaim
              ? "Open daily mystery box"
              : mysteryBox.isOnCooldown
                ? "Mystery box is on cooldown"
                : "Mystery box is unavailable"
          }
        >
          <span aria-hidden="true">[ mystery box ]</span>
          {mysteryBox.isOnCooldown && (
            <small>
              next box in{" "}
              <Countdown
                targetDate={
                  new Date((mysteryBox.lastClaimTime + 86_400) * 1_000)
                }
                onComplete={mysteryBox.refetchEligibility}
              />
            </small>
          )}
        </button>
      )}
      {mysteryBox.mysteryBoxData && (
        <DailyMysteryBoxModal
          open={mysteryBox.showModal}
          onOpenChange={mysteryBox.closeModal}
          activePrograms={mysteryBox.mysteryBoxData.activePrograms}
          hasSupStakingBonus={mysteryBox.hasSupStakingBonus}
          onOpenBox={mysteryBox.handleOpenBox}
          onRetryReward={mysteryBox.retryRewardClaim}
          openResult={mysteryBox.openResult}
          status={mysteryBox.status}
          chain={mysteryBox.chain}
        />
      )}
    </>
  );
}
