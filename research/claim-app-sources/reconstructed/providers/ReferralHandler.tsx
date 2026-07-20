"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

import { useExpectedChains } from "../contexts/ExpectedChainContext";
import { useLocker } from "../contexts/LockerContext";
import { EXTERNAL_ENDPOINTS } from "../lib/endpoints";

const REFERRAL_CODE_STORAGE_KEY = "referralCode";

export function ReferralHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accountAddress, isLockerAddressLoading, isLockerCreated } =
    useLocker();
  const { airdropChain } = useExpectedChains();
  const [referralCode, setReferralCode] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  useEffect(() => {
    setReferralCode(localStorage.getItem(REFERRAL_CODE_STORAGE_KEY) ?? "");
  }, []);
  useEffect(() => {
    const code = searchParams.get("ref");
    if (!code) return;
    localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, code);
    setReferralCode(code);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("ref");
    router.replace(
      `${window.location.pathname}${next.toString() ? `?${next}` : ""}`,
      { scroll: false },
    );
  }, [router, searchParams]);
  const notifyReferral = useMutation({
    mutationFn: async ({
      referralAddress,
      code,
    }: {
      referralAddress: string;
      code: string;
    }) => {
      if (!referralAddress || !code)
        throw new Error("Missing required parameters for referral logging");
      const response = await fetch(
        `${EXTERNAL_ENDPOINTS.referrals}/log-referral`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referralAddress, referralCode: code }),
        },
      );
      if (!response.ok)
        throw new Error(`Failed to log referral: ${response.statusText}`);
      const result = (await response.json()) as {
        success: boolean;
        message?: string;
      };
      if (!result.success) throw new Error(result.message);
    },
    onError: (error) => console.error("Error logging referral:", error),
    retry: 3,
    retryDelay: 15_000,
  });
  useEffect(() => {
    setIsTracking(false);
  }, [accountAddress, referralCode]);
  useEffect(() => {
    if (
      referralCode &&
      accountAddress &&
      !isLockerAddressLoading &&
      !isLockerCreated
    )
      setIsTracking(true);
  }, [accountAddress, isLockerAddressLoading, isLockerCreated, referralCode]);
  useEffect(() => {
    if (!isLockerCreated || !isTracking || !accountAddress) return;
    notifyReferral.mutate({
      referralAddress: accountAddress,
      code: referralCode,
    });
    localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
    setReferralCode("");
    setIsTracking(false);
    // The mutation object is not a semantic trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLockerCreated]);
  void airdropChain; // Both configured chains use the same observed referral endpoint.
  return null;
}
