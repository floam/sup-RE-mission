"use client";

import { useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { encodeFunctionData, parseEther } from "viem";
import {
  useEstimateGas,
  useReadContract,
  useSimulateContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { lockerAbi } from "@sfpro/sdk/abi/sup";

import { useExpectedChains } from "../contexts/ExpectedChainContext";
import { useLockerBalance } from "./useLockerBalance";
import { useSuperfluidWriteContract } from "./useSuperfluidWriteContract";
import {
  getTransactionStatus,
  useLogTransactionErrors,
} from "./useTransactionStatus";
import type { Address } from "../types/program-app";

function useStakingWrite(input: {
  accountAddress?: Address;
  lockerAddress?: Address;
  amount?: bigint;
  functionName: "stake" | "unstake";
  enabled: boolean;
  distributionPool?: Address;
}) {
  const { airdropChain } = useExpectedChains();
  const queryClient = useQueryClient();
  const lockerBalance = useLockerBalance({
    lockerAddress: input.lockerAddress,
  });
  const simulate = useSimulateContract({
    abi: lockerAbi,
    address: input.lockerAddress,
    functionName: input.functionName,
    args: input.amount ? [input.amount] : undefined,
    chainId: airdropChain.id,
    query: { enabled: input.enabled },
    stateOverride: input.accountAddress
      ? [{ address: input.accountAddress, balance: parseEther("100") }]
      : undefined,
  });
  const request = simulate.data?.request;
  const estimate = useEstimateGas({
    chainId: airdropChain.id,
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
  const write = useSuperfluidWriteContract();
  const waitFor = useWaitForTransactionReceipt({
    chainId: airdropChain.id,
    hash: write.data,
    query: { enabled: Boolean(write.data) },
  });
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
  const execute = useCallback(() => {
    if (!request) {
      if (simulate.error) console.error(simulate.error);
      console.error("Error! No transaction simulation data available.");
      return;
    }
    write.writeContract({ ...request, gas: estimate.data });
  }, [estimate.data, request, simulate.error, write]);
  useLogTransactionErrors([simulate, estimate, write, waitFor]);
  return {
    lockerBalance,
    simulate,
    estimate,
    write,
    waitFor,
    isFinished,
    execute,
    status: getTransactionStatus({ simulate, estimate, write, waitFor }),
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
  const { airdropChain } = useExpectedChains();
  const lockerBalance = useLockerBalance({
    lockerAddress: input.lockerAddress,
  });
  const stakedBalance = lockerBalance.data?.stakedBalance ?? 0n;
  const unlocksAt = useReadContract({
    abi: lockerAbi,
    address: input.lockerAddress,
    functionName: "stakingUnlocksAt",
    chainId: airdropChain.id,
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
