"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { encodeFunctionData, parseEther } from "viem";
import {
  useEstimateGas,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { SNAPSHOT_SPACE_BY_CHAIN } from "../config/governance";
import { useExpectedChains } from "../contexts/ExpectedChainContext";
import {
  DELEGATE_MANAGER_ADDRESS,
  delegateManagerAbi,
} from "../contracts/app-contracts";
import type { Address } from "../types/program-app";
import {
  getTransactionStatus,
  useLogTransactionErrors,
} from "./useTransactionStatus";

function useDelegateWrite(input: {
  accountAddress?: Address;
  delegateAddress?: Address;
  functionName: "setDelegate" | "clearDelegate";
  enabled: boolean;
}) {
  const { governanceChain } = useExpectedChains();
  const queryClient = useQueryClient();
  const contractAddress =
    DELEGATE_MANAGER_ADDRESS[governanceChain.id as 8453 | 84532];
  const snapshotSpace = SNAPSHOT_SPACE_BY_CHAIN[governanceChain.id];
  const args =
    input.functionName === "setDelegate"
      ? ([snapshotSpace.id, input.delegateAddress] as const)
      : ([snapshotSpace.id] as const);
  const simulate = useSimulateContract({
    abi: delegateManagerAbi,
    address: contractAddress,
    functionName: input.functionName,
    chainId: governanceChain.id,
    account: input.accountAddress,
    args: args as never,
    query: { enabled: input.enabled },
    stateOverride: input.accountAddress
      ? [{ address: input.accountAddress, balance: parseEther("100") }]
      : undefined,
  });
  const request = simulate.data?.request;
  const estimate = useEstimateGas({
    chainId: governanceChain.id,
    to: request?.address,
    data: request
      ? encodeFunctionData({
          abi: delegateManagerAbi,
          functionName: input.functionName,
          args: args as never,
        })
      : undefined,
    query: { enabled: Boolean(request && input.enabled) },
  });
  const write = useWriteContract();
  const waitFor = useWaitForTransactionReceipt({
    chainId: governanceChain.id,
    hash: write.data,
    query: { enabled: Boolean(write.data) },
  });

  useEffect(() => {
    if (waitFor.status !== "success") return;
    void queryClient.invalidateQueries({ queryKey: ["readContract"] });
    void queryClient.invalidateQueries({ queryKey: ["currentDelegate"] });
  }, [queryClient, waitFor.status]);

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
    simulate,
    estimate,
    write,
    waitFor,
    hash: write.data,
    execute,
    status: getTransactionStatus({ simulate, estimate, write, waitFor }),
  };
}

export function useClearDelegate({
  accountAddress,
  hasExternalDelegate,
}: {
  accountAddress?: Address;
  hasExternalDelegate: boolean;
}) {
  const transaction = useDelegateWrite({
    accountAddress,
    functionName: "clearDelegate",
    enabled: Boolean(accountAddress && hasExternalDelegate),
  });
  return {
    writeClearDelegate: transaction.write,
    simulateClearDelegate: transaction.simulate,
    estimateClearDelegate: transaction.estimate,
    clearDelegateHash: transaction.hash,
    waitForClearDelegate: transaction.waitFor,
    clearDelegate: transaction.execute,
    status: transaction.status,
  };
}

export function useSetDelegate({
  accountAddress,
  delegateAddress,
  hasExternalDelegate,
}: {
  accountAddress?: Address;
  delegateAddress?: Address;
  hasExternalDelegate: boolean;
}) {
  const isSelfDelegate = delegateAddress === accountAddress;
  const transaction = useDelegateWrite({
    accountAddress,
    delegateAddress,
    functionName: "setDelegate",
    enabled: Boolean(
      accountAddress &&
        !hasExternalDelegate &&
        delegateAddress &&
        !isSelfDelegate,
    ),
  });
  return {
    simulateSetDelegate: transaction.simulate,
    estimateSetDelegate: transaction.estimate,
    writeSetDelegate: transaction.write,
    setDelegateHash: transaction.hash,
    waitForSetDelegate: transaction.waitFor,
    setDelegate: transaction.execute,
    status: transaction.status,
  };
}
