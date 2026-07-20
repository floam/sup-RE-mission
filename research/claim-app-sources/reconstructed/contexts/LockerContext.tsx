"use client";

import { createContext, useContext, type PropsWithChildren } from "react";
import { useReadContract } from "wagmi";
import { lockerFactoryAbi } from "@sfpro/sdk/abi/sup";

import {
  FLUID_LOCKER_FACTORY_ADDRESS,
  ZERO_ADDRESS,
} from "../contracts/app-contracts";
import { useExpectedChains } from "./ExpectedChainContext";
import { useWalletAccount } from "../hooks/useWalletAccount";
import type { Address } from "../types/program-app";

interface LockerContextValue {
  accountAddress?: Address;
  lockerAddress?: Address;
  isLockerAddressLoading: boolean;
  isLockerCreated: boolean;
}

const LockerContext = createContext<LockerContextValue | null>(null);

export function LockerProvider({ children }: PropsWithChildren) {
  const { address: accountAddress } = useWalletAccount();
  const { airdropChain } = useExpectedChains();
  const factoryAddress = FLUID_LOCKER_FACTORY_ADDRESS[airdropChain.id as 8453];
  const { data, isLoading } = useReadContract({
    abi: lockerFactoryAbi,
    address: factoryAddress,
    functionName: "getLockerAddress",
    chainId: airdropChain.id,
    args: accountAddress ? [accountAddress] : undefined,
    query: { enabled: Boolean(accountAddress && factoryAddress) },
  });
  const lockerAddress =
    data && data !== ZERO_ADDRESS ? (data as Address) : undefined;

  return (
    <LockerContext.Provider
      value={{
        accountAddress,
        lockerAddress,
        isLockerAddressLoading: isLoading,
        isLockerCreated: Boolean(lockerAddress),
      }}
    >
      {children}
    </LockerContext.Provider>
  );
}

export function useLocker(): LockerContextValue {
  const value = useContext(LockerContext);
  if (!value) throw new Error("useLocker must be used within a LockerProvider");
  return value;
}
