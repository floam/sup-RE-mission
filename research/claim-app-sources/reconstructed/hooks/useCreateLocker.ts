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
import { lockerFactoryAbi } from "@sfpro/sdk/abi/sup";

import { useExpectedChains } from "../contexts/ExpectedChainContext";
import { FLUID_LOCKER_FACTORY_ADDRESS } from "../contracts/app-contracts";
import type { Address } from "../types/program-app";
import { useSuperfluidWriteContract } from "./useSuperfluidWriteContract";
import {
  getTransactionStatus,
  useLogTransactionErrors,
} from "./useTransactionStatus";

export function useCreateLocker(accountAddress?: Address) {
  const { airdropChain } = useExpectedChains();
  const queryClient = useQueryClient();
  const factory = FLUID_LOCKER_FACTORY_ADDRESS[airdropChain.id as 8453];
  const readGetUserLocker = useReadContract({
    abi: lockerFactoryAbi,
    address: factory,
    functionName: "getUserLocker",
    chainId: airdropChain.id,
    args: accountAddress ? [accountAddress] : undefined,
    query: { enabled: Boolean(accountAddress) },
  });
  const [isCreated] = (readGetUserLocker.data as
    | readonly [boolean, Address]
    | undefined) ?? [undefined];
  const simulate = useSimulateContract({
    abi: lockerFactoryAbi,
    address: factory,
    functionName: "createLockerContract",
    chainId: airdropChain.id,
    account: accountAddress,
    query: { enabled: Boolean(accountAddress && isCreated === false) },
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
          abi: lockerFactoryAbi,
          functionName: "createLockerContract",
          args: [],
        })
      : undefined,
    query: { select: (gas) => (120n * gas) / 100n, enabled: Boolean(request) },
  });
  const write = useSuperfluidWriteContract();
  const waitFor = useWaitForTransactionReceipt({
    chainId: airdropChain.id,
    hash: write.data,
    query: { enabled: Boolean(write.data) },
  });
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
  const createLocker = useCallback(() => {
    if (!request) {
      if (simulate.error) console.error(simulate.error);
      console.error("Error! No transaction simulation data available.");
      return;
    }
    write.writeContract({ ...request, gas: estimate.data });
  }, [estimate.data, request, simulate.error, write]);
  useLogTransactionErrors([simulate, estimate, write, waitFor]);
  return {
    readGetUserLocker,
    simulateCreateLocker: simulate,
    estimateCreateLocker: estimate,
    writeCreateLocker: write,
    waitForTransactionCreateLocker: waitFor,
    createLocker,
    status: getTransactionStatus({ simulate, estimate, write, waitFor }),
  };
}
