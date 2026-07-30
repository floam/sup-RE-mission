"use client";

import { useQuery } from "@tanstack/react-query";
import { parseUnits } from "viem";
import { useReadContract } from "wagmi";

import { SNAPSHOT_SPACE_BY_CHAIN } from "../config/governance";
import { APP_CHAIN } from "../config/chains";
import { useLocker } from "../contexts/LockerContext";
import {
  DELEGATE_MANAGER_ADDRESS,
  ZERO_ADDRESS,
  delegateManagerAbi,
} from "../contracts/app-contracts";
import { API_ENDPOINTS } from "../lib/endpoints";
import type { DelegateProfile } from "../types/governance";
import type { Address } from "../types/program-app";
import { useClaimFlowMetrics } from "./useClaimFlowMetrics";

async function fetchDelegates(): Promise<DelegateProfile[]> {
  const response = await fetch(API_ENDPOINTS.delegates);
  if (response.headers.get("X-Delegates-Source") === "snapshot") {
    console.warn(
      "Delegates list served from local snapshot — live source unavailable.",
    );
  }
  return response.json();
}

export function useDelegates() {
  const readDelegates = useQuery({
    queryKey: ["delegates"],
    queryFn: fetchDelegates,
  });
  const { accountAddress } = useLocker();
  let delegates = readDelegates.data ?? [];

  if (accountAddress && delegates.length > 0) {
    const yourself: DelegateProfile = {
      address: accountAddress,
      description:
        "Assign to yourself if you want to directly participate in governance decisions directly. Discuss, make proposals and vote to shape the future of the Superfluid Protocol.",
      name: "Yourself",
      telegram: "",
      url: "",
    };
    delegates = [
      ...delegates.filter(
        (delegate) =>
          delegate.address.toLowerCase() !== accountAddress.toLowerCase(),
      ),
      yourself,
    ];
  }

  return { readDelegates, delegates };
}

export function useDelegatedAmount(delegate?: DelegateProfile) {
  const query = useQuery<number>({
    queryKey: ["delegatedAmount", delegate?.address ?? null],
    enabled: Boolean(delegate && delegate.delegatedAmount === undefined),
    queryFn: async () => {
      const response = await fetch(
        API_ENDPOINTS.delegatedAmount(delegate!.address),
      );
      return response.json();
    },
  });
  const amount = delegate?.delegatedAmount ?? query.data;
  const isDelegatedAmountLoaded = amount !== undefined;
  return {
    delegatedAmount: isDelegatedAmountLoaded
      ? parseUnits(amount.toFixed(18), 18)
      : 0n,
    isDelegatedAmountLoaded,
  };
}

/**
 * Resolves explicit Snapshot delegation. A user with an active claimed stream
 * implicitly self-delegates when the registry contains the zero address.
 */
export function useCurrentDelegate({
  accountAddress,
}: {
  accountAddress?: Address;
}) {
  const { currentClaimedFlowRate } = useClaimFlowMetrics();
  const registryAddress = DELEGATE_MANAGER_ADDRESS[APP_CHAIN.id];
  const snapshotSpace = SNAPSHOT_SPACE_BY_CHAIN[APP_CHAIN.id];
  const readRegistryDelegation = useReadContract({
    abi: delegateManagerAbi,
    address: registryAddress,
    functionName: "delegation",
    chainId: APP_CHAIN.id,
    account: accountAddress,
    args: accountAddress ? [accountAddress, snapshotSpace.id] : undefined,
    query: { enabled: Boolean(accountAddress) },
  });
  const registryDelegate = readRegistryDelegation.data as Address | undefined;
  const delegateAddress =
    registryDelegate && registryDelegate !== ZERO_ADDRESS
      ? registryDelegate
      : currentClaimedFlowRate > 0n
        ? accountAddress
        : undefined;
  const isSelfDelegate = delegateAddress === accountAddress;
  const hasExternalDelegate = Boolean(delegateAddress && !isSelfDelegate);
  const { delegates } = useDelegates();
  const delegateQuery = useQuery<DelegateProfile | null>({
    queryKey: [
      "currentDelegate",
      delegateAddress,
      accountAddress,
      delegates.length,
    ],
    enabled: Boolean(delegateAddress),
    queryFn: async () => {
      if (!delegateAddress) return null;
      return (
        delegates.find(
          (candidate) =>
            candidate.address.toLowerCase() === delegateAddress.toLowerCase(),
        ) ?? {
          address: delegateAddress,
          description: "",
          name: "",
          telegram: "",
          url: "",
        }
      );
    },
  });

  return {
    readRegistryDelegation,
    delegateAddress,
    hasExternalDelegate,
    isSelfDelegate,
    delegate: delegateQuery.data ?? undefined,
  };
}
