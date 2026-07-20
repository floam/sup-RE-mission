"use client";

import { useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { encodeFunctionData, erc20Abi, parseEther } from "viem";
import {
  useEstimateGas,
  useReadContract,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { lockerAbi } from "@sfpro/sdk/abi/sup";

import { useExpectedChains } from "../contexts/ExpectedChainContext";
import { SUP_TOKEN_ADDRESS_BY_CHAIN } from "../contracts/app-contracts";
import type { Address } from "../types/program-app";
import { recordRecentTransaction } from "./useRecentTransactions";
import {
  getTransactionStatus,
  useLogTransactionErrors,
} from "./useTransactionStatus";

function useApproveSup({
  accountAddress,
  lockerAddress,
  amount,
}: {
  accountAddress?: Address;
  lockerAddress?: Address;
  amount?: bigint;
}) {
  const { airdropChain } = useExpectedChains();
  const queryClient = useQueryClient();
  const token = SUP_TOKEN_ADDRESS_BY_CHAIN[airdropChain.id];
  const balance = useReadContract({
    abi: erc20Abi,
    address: token,
    functionName: "balanceOf",
    chainId: airdropChain.id,
    args: accountAddress ? [accountAddress] : undefined,
    query: { enabled: Boolean(accountAddress) },
  });
  const allowance = useReadContract({
    abi: erc20Abi,
    address: token,
    functionName: "allowance",
    chainId: airdropChain.id,
    args:
      accountAddress && lockerAddress
        ? [accountAddress, lockerAddress]
        : undefined,
    query: { enabled: Boolean(accountAddress && lockerAddress) },
  });
  const supBalance = balance.data ?? 0n;
  const approved = allowance.data ?? 0n;
  const needsApproval =
    !amount || allowance.data === undefined || amount > approved;
  const isValid = Boolean(
    lockerAddress &&
      accountAddress &&
      amount &&
      amount > 0n &&
      amount <= supBalance &&
      needsApproval,
  );
  const simulate = useSimulateContract({
    abi: erc20Abi,
    address: token,
    functionName: "approve",
    chainId: airdropChain.id,
    args: lockerAddress && amount ? [lockerAddress, amount] : undefined,
    query: { enabled: isValid },
    stateOverride: accountAddress
      ? [{ address: accountAddress, balance: parseEther("100") }]
      : undefined,
  });
  const request = simulate.data?.request;
  const estimate = useEstimateGas({
    chainId: airdropChain.id,
    to: request?.address,
    data: request
      ? encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: request.args as never,
        })
      : undefined,
    query: {
      select: (gas) => (120n * gas) / 100n,
      enabled: Boolean(request && isValid),
    },
    stateOverride: accountAddress
      ? [{ address: accountAddress, balance: parseEther("100") }]
      : undefined,
  });
  const write = useWriteContract();
  const waitFor = useWaitForTransactionReceipt({
    chainId: airdropChain.id,
    hash: write.data,
    query: { enabled: Boolean(write.data) },
  });
  const isFinished = write.isSuccess && waitFor.isSuccess;
  useEffect(() => {
    if (isFinished)
      void queryClient.invalidateQueries({ queryKey: ["allowance", token] });
  }, [isFinished, queryClient, token]);
  const approve = useCallback(() => {
    if (!request) {
      if (simulate.error) console.error(simulate.error);
      console.error("Error! No approval simulation data available.");
      return;
    }
    write.writeContract({ ...request, gas: estimate.data });
  }, [estimate.data, request, simulate.error, write]);
  useLogTransactionErrors([simulate, estimate, write, waitFor]);
  return {
    needsApproval,
    supBalance,
    allowance: approved,
    approve,
    status: getTransactionStatus({ simulate, estimate, write, waitFor }),
    isFinished,
    reset: write.reset,
  };
}

function useLockSup({
  accountAddress,
  lockerAddress,
  amount,
}: {
  accountAddress?: Address;
  lockerAddress?: Address;
  amount?: bigint;
}) {
  const { airdropChain } = useExpectedChains();
  const queryClient = useQueryClient();
  const token = SUP_TOKEN_ADDRESS_BY_CHAIN[airdropChain.id];
  const balance = useReadContract({
    abi: erc20Abi,
    address: token,
    functionName: "balanceOf",
    chainId: airdropChain.id,
    args: accountAddress ? [accountAddress] : undefined,
    query: { enabled: Boolean(accountAddress), refetchInterval: 30_000 },
  });
  const allowance = useReadContract({
    abi: erc20Abi,
    address: token,
    functionName: "allowance",
    chainId: airdropChain.id,
    args:
      accountAddress && lockerAddress
        ? [accountAddress, lockerAddress]
        : undefined,
    query: { enabled: Boolean(accountAddress && lockerAddress) },
  });
  const supBalance = balance.data ?? 0n;
  const approved = allowance.data ?? 0n;
  const isValid = Boolean(
    lockerAddress &&
      accountAddress &&
      amount &&
      amount > 0n &&
      amount <= supBalance &&
      approved >= amount,
  );
  const simulate = useSimulateContract({
    abi: lockerAbi,
    address: lockerAddress,
    functionName: "lock",
    chainId: airdropChain.id,
    args: amount ? [amount] : undefined,
    query: { enabled: isValid },
    stateOverride: accountAddress
      ? [{ address: accountAddress, balance: parseEther("100") }]
      : undefined,
  });
  const request = simulate.data?.request;
  const estimate = useEstimateGas({
    chainId: airdropChain.id,
    to: request?.address,
    data: request
      ? encodeFunctionData({
          abi: lockerAbi,
          functionName: "lock",
          args: request.args as never,
        })
      : undefined,
    query: {
      select: (gas) => (120n * gas) / 100n,
      enabled: Boolean(request && isValid),
    },
    stateOverride: accountAddress
      ? [{ address: accountAddress, balance: parseEther("100") }]
      : undefined,
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
    recordRecentTransaction({
      type: "deposited-in-reserve",
      hash: write.data,
      timestamp: Date.now(),
    });
    void queryClient.invalidateQueries({ queryKey: ["balance", token] });
    void queryClient.invalidateQueries({ queryKey: ["allowance", token] });
    void queryClient.invalidateQueries({
      queryKey: ["locker-balance", lockerAddress],
    });
  }, [isFinished, lockerAddress, queryClient, token, write.data]);
  const lock = useCallback(() => {
    if (!request) {
      if (simulate.error) console.error(simulate.error);
      console.error("Error! No transaction simulation data available.");
      return;
    }
    write.writeContract({ ...request, gas: estimate.data });
  }, [estimate.data, request, simulate.error, write]);
  useLogTransactionErrors([simulate, estimate, write, waitFor]);
  return {
    supBalance,
    lock,
    status: getTransactionStatus({ simulate, estimate, write, waitFor }),
    isFinished,
    reset: write.reset,
  };
}

export function useDepositToReserve(input: {
  accountAddress?: Address;
  lockerAddress?: Address;
  amount?: bigint;
}) {
  const approval = useApproveSup(input);
  const lock = useLockSup(input);
  return { approval, lock };
}
