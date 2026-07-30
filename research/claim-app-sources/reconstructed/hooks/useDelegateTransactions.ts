"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { encodeFunctionData, parseEther } from "viem";
import { useEstimateGas, useSimulateContract } from "wagmi";

import { SNAPSHOT_SPACE_BY_CHAIN } from "../config/governance";
import { APP_CHAIN } from "../config/chains";
import {
  DELEGATE_MANAGER_ADDRESS,
  delegateManagerAbi,
} from "../contracts/app-contracts";
import type { Address } from "../types/program-app";
import { useContractTransaction } from "./useContractTransaction";

function useDelegateWrite(input: {
  accountAddress?: Address;
  delegateAddress?: Address;
  functionName: "setDelegate" | "clearDelegate";
  enabled: boolean;
}) {
  const queryClient = useQueryClient();
  const contractAddress = DELEGATE_MANAGER_ADDRESS[APP_CHAIN.id];
  const snapshotSpace = SNAPSHOT_SPACE_BY_CHAIN[APP_CHAIN.id];
  const args =
    input.functionName === "setDelegate"
      ? ([snapshotSpace.id, input.delegateAddress] as const)
      : ([snapshotSpace.id] as const);
  const simulate = useSimulateContract({
    abi: delegateManagerAbi,
    address: contractAddress,
    functionName: input.functionName,
    chainId: APP_CHAIN.id,
    account: input.accountAddress,
    args: args as never,
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
          abi: delegateManagerAbi,
          functionName: input.functionName,
          args: args as never,
        })
      : undefined,
    query: { enabled: Boolean(request && input.enabled) },
  });
  const transaction = useContractTransaction({
    request,
    gas: estimate.data,
    simulate,
    estimate,
  });
  const { write, waitFor, execute } = transaction;

  useEffect(() => {
    if (waitFor.status !== "success") return;
    void queryClient.invalidateQueries({ queryKey: ["readContract"] });
    void queryClient.invalidateQueries({ queryKey: ["currentDelegate"] });
  }, [queryClient, waitFor.status]);

  return {
    simulate,
    estimate,
    write,
    waitFor,
    hash: write.data,
    execute,
    status: transaction.status,
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
