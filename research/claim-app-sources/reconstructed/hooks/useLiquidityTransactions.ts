"use client";

import { useCallback, useEffect } from "react";
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

import { useExpectedChains } from "../contexts/ExpectedChainContext";
import type { Address } from "../types/program-app";
import { recordRecentTransaction } from "./useRecentTransactions";
import {
  getTransactionStatus,
  useLogTransactionErrors,
} from "./useTransactionStatus";

type LockerWriteFunction =
  | "provideLiquidity"
  | "withdrawLiquidity"
  | "collectFees";

function useLockerWrite(input: {
  accountAddress?: Address;
  lockerAddress?: Address;
  functionName: LockerWriteFunction;
  args?: readonly unknown[];
  value?: bigint;
  enabled: boolean;
  recentTransactionType?: string;
}) {
  const { airdropChain } = useExpectedChains();
  const queryClient = useQueryClient();
  const stateOverride = input.accountAddress
    ? [{ address: input.accountAddress, balance: parseEther("100") }]
    : undefined;
  const simulate = useSimulateContract({
    abi: lockerAbi,
    address: input.lockerAddress,
    functionName: input.functionName,
    chainId: airdropChain.id,
    args: input.args as never,
    value: input.value,
    query: { enabled: input.enabled },
    stateOverride,
  });
  const request = simulate.data?.request;
  const estimate = useEstimateGas({
    chainId: airdropChain.id,
    to: request?.address,
    data: request
      ? encodeFunctionData({
          abi: lockerAbi,
          functionName: input.functionName,
          args: input.args as never,
        })
      : undefined,
    query: {
      select: (gas) => (120n * gas) / 100n,
      enabled: Boolean(request && input.enabled),
    },
    stateOverride,
  });
  const write = useWriteContract();
  const waitFor = useWaitForTransactionReceipt({
    chainId: airdropChain.id,
    hash: write.data,
    query: { enabled: Boolean(write.data) },
  });
  const isFinished = write.isSuccess && waitFor.isSuccess;
  useEffect(() => {
    if (!isFinished || !write.data) return;
    if (input.recentTransactionType)
      recordRecentTransaction({
        type: input.recentTransactionType,
        hash: write.data,
        timestamp: Date.now(),
      });
    void queryClient.invalidateQueries({
      queryKey: ["active-liquidity-positions", input.lockerAddress ?? null],
    });
    void queryClient.invalidateQueries({
      queryKey: ["readLocker", "getPositionLiquidity"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["readNonfungiblePositionManager", "positions"],
    });
    void queryClient.invalidateQueries({ queryKey: ["readContracts"] });
    void queryClient.invalidateQueries({
      queryKey: ["locker-balance", input.lockerAddress],
    });
  }, [
    input.lockerAddress,
    input.recentTransactionType,
    isFinished,
    queryClient,
    write.data,
  ]);
  const execute = useCallback(() => {
    if (!request) {
      if (simulate.error) console.error(simulate.error);
      console.error("Error! No transaction simulation data available.");
      return;
    }
    write.writeContract({ ...request, gas: estimate.data, value: input.value });
  }, [estimate.data, input.value, request, simulate.error, write]);
  useLogTransactionErrors([simulate, estimate, write, waitFor]);
  return {
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

export function useProvideLiquidity(input: {
  accountAddress?: Address;
  lockerAddress?: Address;
  supAmount?: bigint;
  ethAmount?: bigint;
}) {
  const transaction = useLockerWrite({
    ...input,
    functionName: "provideLiquidity",
    args: input.supAmount ? [input.supAmount] : undefined,
    value: input.ethAmount,
    enabled: Boolean(
      input.lockerAddress &&
        input.accountAddress &&
        input.supAmount &&
        input.supAmount > 0n &&
        input.ethAmount &&
        input.ethAmount > 0n,
    ),
    recentTransactionType: "liquidity-position-created",
  });
  return { ...transaction, provideLiquidity: transaction.execute };
}

export function useWithdrawLiquidity(input: {
  accountAddress?: Address;
  lockerAddress?: Address;
  tokenId?: bigint;
  liquidityToRemove?: bigint;
  amount0ToRemove?: bigint;
  amount1ToRemove?: bigint;
}) {
  const { airdropChain } = useExpectedChains();
  const cooldown = useReadContract({
    abi: lockerAbi,
    address: input.lockerAddress,
    functionName: "lpCooldownTimestamps",
    chainId: airdropChain.id,
    args: input.tokenId ? [input.tokenId] : undefined,
    query: { enabled: Boolean(input.lockerAddress && input.tokenId) },
  });
  const cooldownExpired = Boolean(
    cooldown.data && Math.floor(Date.now() / 1_000) > Number(cooldown.data),
  );
  const args =
    input.tokenId &&
    input.liquidityToRemove &&
    input.amount0ToRemove &&
    input.amount1ToRemove
      ? ([
          input.tokenId,
          input.liquidityToRemove,
          input.amount0ToRemove,
          input.amount1ToRemove,
        ] as const)
      : undefined;
  const transaction = useLockerWrite({
    ...input,
    functionName: "withdrawLiquidity",
    args,
    enabled: Boolean(
      input.lockerAddress &&
        input.accountAddress &&
        input.tokenId &&
        input.liquidityToRemove &&
        input.liquidityToRemove > 0n &&
        input.amount0ToRemove &&
        input.amount1ToRemove &&
        cooldownExpired,
    ),
    recentTransactionType: "liquidity-position-withdrawn",
  });
  return {
    ...transaction,
    cooldownTimestamp: cooldown.data,
    isCooldownExpired: cooldownExpired,
    withdrawLiquidity: transaction.execute,
  };
}

export function useCollectFees(input: {
  accountAddress?: Address;
  lockerAddress?: Address;
  tokenId?: bigint;
}) {
  const transaction = useLockerWrite({
    ...input,
    functionName: "collectFees",
    args: input.tokenId ? [input.tokenId] : undefined,
    enabled: Boolean(
      input.lockerAddress && input.accountAddress && input.tokenId,
    ),
  });
  return { ...transaction, collectFees: transaction.execute };
}
