"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { BonusModal } from "../components/campaign/BonusModal";
import { claimBonusFlows, checkBonusFlows } from "../hooks/useBonusFlows";
import { useWalletAccount } from "../hooks/useWalletAccount";
import type { BonusClaimResult } from "../types/campaign-rewards";

export function BonusModalProvider() {
  const { address, isConnected } = useWalletAccount();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [shownForAddress, setShownForAddress] = useState(
    () => new Map<string, boolean>(),
  );
  const [claimResult, setClaimResult] = useState<BonusClaimResult | null>(null);
  const bonus = useQuery({
    queryKey: ["bonusFlows", address],
    queryFn: () => checkBonusFlows(address!),
    enabled: Boolean(address && isConnected),
    refetchOnWindowFocus: false,
  });
  const claim = useMutation({
    mutationKey: ["claimBonusFlows", address],
    mutationFn: () => claimBonusFlows(address!),
    onSuccess: (result) => {
      setClaimResult(result);
      if (result.success)
        void queryClient.invalidateQueries({
          queryKey: ["getAccountProgramPointStates", address],
          refetchType: "all",
        });
      else console.error("Failed to claim bonus flows");
    },
    onError: (error) => console.error("Bonus flows claim error:", error),
  });
  useEffect(() => {
    if (
      !address ||
      !isConnected ||
      !bonus.data?.success ||
      !bonus.data.shouldShow ||
      shownForAddress.get(address) ||
      bonus.isLoading
    )
      return;
    setShowModal(true);
    setShownForAddress((current) => new Map(current).set(address, true));
  }, [address, bonus.data, bonus.isLoading, isConnected, shownForAddress]);
  if (!bonus.data?.success) return null;
  return (
    <BonusModal
      open={showModal}
      onOpenChange={(open) => {
        setShowModal(open);
        if (!open) setClaimResult(null);
      }}
      onClaimBonus={() => address && claim.mutate()}
      claimResult={claimResult}
      isClaimPending={claim.isPending}
      supPerMonth={bonus.data.supPerMonth}
    />
  );
}
