"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { APP_CHAIN } from "../config/chains";
import { useLocker } from "../contexts/LockerContext";

async function requestGoodDollarSponsorship(address: string) {
  try {
    const response = await fetch(
      `https://superfluid-airdrop.goodworker.workers.dev/?address=${address}`,
    );
    const body = (await response.json()) as {
      error?: string;
      [key: string]: unknown;
    };
    return { ...body, success: body.error === undefined };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function GoodDollarProvider() {
  const queryClient = useQueryClient();
  const { accountAddress, isLockerCreated } = useLocker();
  const eligibleAddress =
    isLockerCreated !== undefined ? accountAddress : undefined;
  const [requested, setRequested] = useState(() => new Map<string, boolean>());
  const sponsorship = useMutation({
    mutationKey: ["notifyGoodDollar", eligibleAddress ?? null],
    mutationFn: requestGoodDollarSponsorship,
    onSuccess: (result) => {
      if (!result.success || !eligibleAddress || isLockerCreated) return;
      console.info(
        "GoodDollar is sponsoring your claim! The ETH for gas should arrive shortly.",
      );
      void queryClient.invalidateQueries({
        queryKey: [
          "balance",
          { address: eligibleAddress, chainId: APP_CHAIN.id },
        ],
        refetchType: "all",
      });
      void queryClient.invalidateQueries({
        queryKey: ["getAccountProgramPointStates", eligibleAddress],
        refetchType: "all",
      });
      void queryClient.invalidateQueries({
        queryKey: ["getAccountPointClaim", eligibleAddress],
        refetchType: "all",
      });
    },
    onError: () =>
      eligibleAddress &&
      setRequested((current) => new Map(current).set(eligibleAddress, false)),
  });
  useEffect(() => {
    if (!eligibleAddress || requested.get(eligibleAddress) === true) return;
    sponsorship.mutate(eligibleAddress);
    setRequested((current) => new Map(current).set(eligibleAddress, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleAddress]);
  return null;
}
