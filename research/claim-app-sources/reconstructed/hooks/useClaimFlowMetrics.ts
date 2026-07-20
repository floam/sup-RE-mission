"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { useLocker } from "../contexts/LockerContext";
import type { ProgramPoolInfo } from "../types/program-app";
import type { ProgramPointState } from "../types/transactions";
import { useAccountProgramPointStates } from "./useClaimTransaction";
import { useLockerBalance } from "./useLockerBalance";

export type ProgramPoolInfoLoader = () => Promise<ProgramPoolInfo[]>;

export function calculateClaimFlowRates({
  pointStates,
  poolInfos,
  currentClaimedFlowRate,
  canClaim,
}: {
  pointStates: readonly ProgramPointState[];
  poolInfos: readonly ProgramPoolInfo[];
  currentClaimedFlowRate: bigint;
  canClaim: boolean | undefined;
}) {
  const eligibleStates = pointStates.filter(
    (state) => state.offchainPoints > 0n,
  );
  const currentOnchainFlowRate = eligibleStates.reduce((sum, state) => {
    const pool = poolInfos.find(
      (candidate) => candidate.programId === state.programId,
    );
    return pool
      ? sum +
          (pool.totalFlowRate / (pool.totalUnits || 1n)) * state.onchainPoints
      : sum;
  }, 0n);
  const totalClaimableFlowRate =
    canClaim === false ||
    eligibleStates.every((state) => !state.isOnchainOutdated)
      ? currentClaimedFlowRate
      : eligibleStates.reduce((sum, state) => {
          const pool = poolInfos.find(
            (candidate) => candidate.programId === state.programId,
          );
          if (!pool) return sum;
          const unitsAfterClaim =
            pool.totalUnits + (state.offchainPoints - state.onchainPoints);
          return (
            sum +
            (pool.totalFlowRate / (unitsAfterClaim || 1n)) *
              state.offchainPoints
          );
        }, 0n);
  return {
    currentOnchainFlowRate,
    totalClaimableFlowRate,
    extraClaimableFlowRate: totalClaimableFlowRate - currentOnchainFlowRate,
  };
}

/**
 * The client called server action `getProgramPoolInfos`
 * (`003f4c4ef5e976bf16920f03d8a97174f1d8ae67e6`). Its server-only body was not
 * emitted, so callers supply that boundary when reconstructing a runnable app.
 */
export function useClaimFlowMetrics(
  loadProgramPoolInfos?: ProgramPoolInfoLoader,
) {
  const { accountAddress, lockerAddress } = useLocker();
  const pointStates = useAccountProgramPointStates(accountAddress);
  const lockerBalance = useLockerBalance({ lockerAddress });
  const liveFlowRate = lockerBalance.data?.flowRate ?? 0n;
  const [largestObservedFlowRate, setLargestObservedFlowRate] = useState(
    new Map<string, bigint>(),
  );

  useEffect(() => {
    if (accountAddress && liveFlowRate > 0n) {
      setLargestObservedFlowRate((current) =>
        new Map(current).set(accountAddress, liveFlowRate),
      );
    }
  }, [accountAddress, liveFlowRate]);

  const currentClaimedFlowRate = accountAddress
    ? [largestObservedFlowRate.get(accountAddress) ?? 0n, liveFlowRate].reduce(
        (largest, value) => (value > largest ? value : largest),
        0n,
      )
    : 0n;
  const readProgramPoolInfos = useQuery({
    queryKey: ["programPoolInfos"],
    queryFn: loadProgramPoolInfos!,
    enabled: Boolean(loadProgramPoolInfos),
  });
  const flowRates = useMemo(
    () =>
      calculateClaimFlowRates({
        pointStates: pointStates.data?.programPointStates ?? [],
        poolInfos: readProgramPoolInfos.data ?? [],
        currentClaimedFlowRate,
        canClaim: pointStates.data?.canClaim,
      }),
    [currentClaimedFlowRate, pointStates.data, readProgramPoolInfos.data],
  );

  return {
    readAccountProgramPointStates: pointStates,
    readProgramPoolInfos,
    readLockerBalance: lockerBalance,
    currentClaimedFlowRate,
    ...flowRates,
  };
}
