"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { encodeFunctionData, parseEther } from "viem";
import { useEstimateGas, useReadContract, useSimulateContract } from "wagmi";
import { lockerAbi } from "@sfpro/sdk/abi/sup";

import { APP_CHAIN } from "../config/chains";
import { useLockerBalance } from "./useLockerBalance";
import { useContractTransaction } from "./useContractTransaction";
import type { Address } from "../types/program-app";

function useStakingWrite(input: {
  accountAddress?: Address;
  lockerAddress?: Address;
  amount?: bigint;
  functionName: "stake" | "unstake";
  enabled: boolean;
  distributionPool?: Address;
}) {
  const queryClient = useQueryClient();
  const lockerBalance = useLockerBalance({
    lockerAddress: input.lockerAddress,
  });
  const simulate = useSimulateContract({
    abi: lockerAbi,
    address: input.lockerAddress,
    functionName: input.functionName,
    args: input.amount ? [input.amount] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: input.enabled },
    stateOverride: input.accountAddress
      ? [{ address: input.accountAddress, balance: parseEther("100") }]
      : undefined,
  });
  const request = simulate.data?.request;
  const estimate = useEstimateGas({
    chainId: APP_CHAIN.id,
    to: request?.address,
    data: request
      ? encodeFunctionData({
          abi: lockerAbi,
          functionName: input.functionName,
          args: input.amount ? [input.amount] : undefined,
        })
      : undefined,
    query: {
      select: (gas) => (120n * gas) / 100n,
      enabled: Boolean(request && input.enabled),
    },
    stateOverride: input.accountAddress
      ? [{ address: input.accountAddress, balance: parseEther("100") }]
      : undefined,
  });
  const transaction = useContractTransaction({
    request,
    gas: estimate.data,
    simulate,
    estimate,
  });
  const { write, waitFor, execute } = transaction;
  const isFinished = write.isSuccess && waitFor.isSuccess;
  useEffect(() => {
    if (!isFinished) return;
    void queryClient.invalidateQueries({
      queryKey: ["locker-balance", input.lockerAddress],
    });
    void queryClient.invalidateQueries({
      queryKey: ["readLocker", "getAvailableBalance"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["readLocker", "getStakedBalance"],
    });
    void queryClient.invalidateQueries({
      queryKey: [
        "accumulated-rewards",
        input.lockerAddress,
        input.distributionPool,
      ],
    });
  }, [input.distributionPool, input.lockerAddress, isFinished, queryClient]);
  return {
    lockerBalance,
    simulate,
    estimate,
    write,
    waitFor,
    isFinished,
    execute,
    status: transaction.status,
    reset: write.reset,
  };
}

export function useLockerStake(input: {
  accountAddress?: Address;
  lockerAddress?: Address;
  amount?: bigint;
  distributionPool?: Address;
}) {
  const lockerBalance = useLockerBalance({
    lockerAddress: input.lockerAddress,
  });
  const availableBalance = lockerBalance.data?.availableBalance ?? 0n;
  const transaction = useStakingWrite({
    ...input,
    functionName: "stake",
    enabled: Boolean(
      input.accountAddress &&
      input.lockerAddress &&
      input.amount &&
      input.amount > 0n &&
      input.amount <= availableBalance,
    ),
  });
  return { ...transaction, stake: transaction.execute };
}

export function useLockerUnstake(input: {
  accountAddress?: Address;
  lockerAddress?: Address;
  amount?: bigint;
  distributionPool?: Address;
}) {
  const lockerBalance = useLockerBalance({
    lockerAddress: input.lockerAddress,
  });
  const stakedBalance = lockerBalance.data?.stakedBalance ?? 0n;
  const unlocksAt = useReadContract({
    abi: lockerAbi,
    address: input.lockerAddress,
    functionName: "stakingUnlocksAt",
    chainId: APP_CHAIN.id,
    query: { enabled: Boolean(input.lockerAddress) },
  });
  const stakingUnlocksAt = Number(unlocksAt.data ?? 0);
  const canUnstake =
    stakedBalance > 0n && stakingUnlocksAt <= Math.floor(Date.now() / 1_000);
  const transaction = useStakingWrite({
    ...input,
    functionName: "unstake",
    enabled: Boolean(
      input.accountAddress &&
      input.lockerAddress &&
      input.amount &&
      input.amount > 0n &&
      input.amount <= stakedBalance &&
      canUnstake,
    ),
  });
  return {
    ...transaction,
    unstake: transaction.execute,
    stakingUnlocksAt,
    canUnstake,
    readStakingUnlocksAt: unlocksAt,
  };
}
