"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { encodeFunctionData, parseEther } from "viem";
import { useEstimateGas, useReadContract, useSimulateContract } from "wagmi";
import { lockerFactoryAbi } from "@sfpro/sdk/abi/sup";

import { APP_CHAIN } from "../config/chains";
import { FLUID_LOCKER_FACTORY_ADDRESS } from "../contracts/app-contracts";
import type { Address } from "../types/program-app";
import { useContractTransaction } from "./useContractTransaction";

export function useCreateLocker(accountAddress?: Address) {
  const queryClient = useQueryClient();
  const factory = FLUID_LOCKER_FACTORY_ADDRESS[APP_CHAIN.id];
  const readGetUserLocker = useReadContract({
    abi: lockerFactoryAbi,
    address: factory,
    functionName: "getUserLocker",
    chainId: APP_CHAIN.id,
    args: accountAddress ? [accountAddress] : undefined,
    query: { enabled: Boolean(accountAddress) },
  });
  const [isCreated] = (readGetUserLocker.data as
    readonly [boolean, Address] | undefined) ?? [undefined];
  const simulate = useSimulateContract({
    abi: lockerFactoryAbi,
    address: factory,
    functionName: "createLockerContract",
    chainId: APP_CHAIN.id,
    account: accountAddress,
    query: { enabled: Boolean(accountAddress && isCreated === false) },
    stateOverride: accountAddress
      ? [{ address: accountAddress, balance: parseEther("100") }]
      : undefined,
  });
  const request = simulate.data?.request;
  const estimate = useEstimateGas({
    chainId: APP_CHAIN.id,
    to: request?.address,
    data: request
      ? encodeFunctionData({
          abi: lockerFactoryAbi,
          functionName: "createLockerContract",
          args: [],
        })
      : undefined,
    query: { select: (gas) => (120n * gas) / 100n, enabled: Boolean(request) },
  });
  const transaction = useContractTransaction({
    request,
    gas: estimate.data,
    simulate,
    estimate,
  });
  const { write, waitFor, execute: createLocker } = transaction;
  useEffect(() => {
    if (waitFor.status === "success")
      void queryClient.invalidateQueries({
        queryKey: ["readContract", factory],
      });
  }, [factory, queryClient, waitFor.status]);
  const refetchUserLocker = readGetUserLocker.refetch;
  useEffect(() => {
    if (waitFor.data?.status === "success") void refetchUserLocker();
  }, [refetchUserLocker, waitFor.data?.status]);
  return {
    readGetUserLocker,
    simulateCreateLocker: simulate,
    estimateCreateLocker: estimate,
    writeCreateLocker: write,
    waitForTransactionCreateLocker: waitFor,
    createLocker,
    status: transaction.status,
  };
}
