"use client";

import { createContext, useContext, type PropsWithChildren } from "react";
import type { Chain } from "viem";

import { airdropChain, governanceChain } from "../config/chains";

export interface ExpectedChains {
  airdropChain: Chain;
  governanceChain: Chain;
}

const ExpectedChainContext = createContext<ExpectedChains | undefined>(
  undefined,
);

export function ExpectedChainProvider({ children }: PropsWithChildren) {
  return (
    <ExpectedChainContext.Provider value={{ airdropChain, governanceChain }}>
      {children}
    </ExpectedChainContext.Provider>
  );
}

export function useExpectedChains(): ExpectedChains {
  const value = useContext(ExpectedChainContext);
  if (value === undefined) {
    throw new Error(
      "useExpectedChains must be used within an ExpectedChainProvider",
    );
  }
  return value;
}
