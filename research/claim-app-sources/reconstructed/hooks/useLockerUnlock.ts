"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { encodeFunctionData, parseEther } from "viem";
import {
  useEstimateGas,
  useReadContract,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { lockerAbi } from "@sfpro/sdk/abi/sup";

import { APP_CHAIN } from "../config/chains";
import {
  MAX_UNLOCK_DAYS,
  MIN_UNLOCK_AMOUNT,
  MIN_UNLOCK_DAYS,
  SUP_TOKEN_ADDRESS_BY_CHAIN,
  UNLOCKING_FEE,
} from "../contracts/app-contracts";
import type { Address } from "../types/program-app";
import { recordRecentTransaction } from "./useRecentTransactions";
import {
  getTransactionStatus,
  useLogTransactionErrors,
} from "./useTransactionStatus";

export function useLockerUnlock({
  accountAddress,
  lockerAddress,
  unlockPeriodDays,
  amount,
}: {
  accountAddress?: Address;
  lockerAddress?: Address;
  unlockPeriodDays?: number;
  amount?: bigint;
}) {
  const queryClient = useQueryClient();
  const { data: availableBalance } = useReadContract({
    abi: lockerAbi,
    address: lockerAddress,
    functionName: "getAvailableBalance",
    chainId: APP_CHAIN.id,
    query: { enabled: Boolean(lockerAddress) },
  });
  const { data: lockerOwner } = useReadContract({
    abi: lockerAbi,
    address: lockerAddress,
    functionName: "lockerOwner",
    chainId: APP_CHAIN.id,
    query: { enabled: Boolean(lockerAddress) },
  });
  const isOwner = Boolean(
    accountAddress &&
    lockerOwner &&
    accountAddress.toLowerCase() === lockerOwner.toLowerCase(),
  );
  const unlockPeriodSeconds = useMemo(
    () =>
      unlockPeriodDays === undefined
        ? undefined
        : BigInt(Math.floor(86_400 * unlockPeriodDays)),
    [unlockPeriodDays],
  );
  const available = availableBalance ?? 0n;
  const isValid = Boolean(
    lockerAddress &&
    accountAddress &&
    unlockPeriodSeconds !== undefined &&
    unlockPeriodDays !== undefined &&
    (unlockPeriodDays === 0 || unlockPeriodDays >= MIN_UNLOCK_DAYS) &&
    unlockPeriodDays <= MAX_UNLOCK_DAYS &&
    amount &&
    amount >= MIN_UNLOCK_AMOUNT &&
    amount <= available &&
    isOwner,
  );
  const stateOverride = accountAddress
    ? [{ address: accountAddress, balance: parseEther("100") }]
    : undefined;
  const simulate = useSimulateContract({
    abi: lockerAbi,
    address: lockerAddress,
    functionName: "unlock",
    chainId: APP_CHAIN.id,
    args:
      amount && unlockPeriodSeconds && accountAddress
        ? [amount, unlockPeriodSeconds, accountAddress]
        : undefined,
    value: UNLOCKING_FEE,
    query: { enabled: isValid },
    stateOverride,
  });
  const request = simulate.data?.request;
  const estimate = useEstimateGas({
    chainId: APP_CHAIN.id,
    to: request?.address,
    data: request
      ? encodeFunctionData({
          abi: lockerAbi,
          functionName: "unlock",
          args: request.args as never,
        })
      : undefined,
    value: request?.value,
    query: {
      select: (gas) => (120n * gas) / 100n,
      enabled: Boolean(request && isValid),
    },
    stateOverride,
  });
  const write = useWriteContract();
  const waitFor = useWaitForTransactionReceipt({
    chainId: APP_CHAIN.id,
    hash: write.data,
    query: { enabled: Boolean(write.data) },
  });
  const isFinished = write.isSuccess && waitFor.isSuccess;

  useEffect(() => {
    if (!isFinished || !write.data) return;
    if (unlockPeriodDays && unlockPeriodDays > 0) {
      recordRecentTransaction({
        type: "stream-withdrawn-from-reserve",
        hash: write.data,
        timestamp: Date.now(),
      });
    }
    void queryClient.invalidateQueries({
      queryKey: ["locker-balance", lockerAddress],
    });
    void queryClient.invalidateQueries({
      queryKey: [
        "balance",
        SUP_TOKEN_ADDRESS_BY_CHAIN[APP_CHAIN.id],
        lockerAddress,
      ],
    });
  }, [
    APP_CHAIN.id,
    isFinished,
    lockerAddress,
    queryClient,
    unlockPeriodDays,
    write.data,
  ]);

  const unlock = useCallback(() => {
    if (!request) {
      if (simulate.error) console.error(simulate.error);
      console.error("Error! No transaction simulation data available.");
      return;
    }
    write.writeContract({
      ...request,
      gas: estimate.data,
      value: UNLOCKING_FEE,
    } as never);
  }, [estimate.data, request, simulate.error, write]);
  useLogTransactionErrors([simulate, estimate, write, waitFor]);

  return {
    availableBalance: available,
    isUnlockAvailable: true,
    simulateLockerUnlock: simulate,
    estimateUnlock: estimate,
    writeLockerUnlock: write,
    waitForTransactionUnlock: waitFor,
    isFinished,
    unlock,
    status: getTransactionStatus({ simulate, estimate, write, waitFor }),
    reset: write.reset,
  };
}
