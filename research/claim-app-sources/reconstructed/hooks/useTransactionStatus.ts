"use client";

import { useEffect } from "react";

import type { TransactionStatus } from "../types/transactions";

interface QueryState {
  isFetching?: boolean;
  isError?: boolean;
  isSuccess?: boolean;
  isPending?: boolean;
  error?: unknown;
}

export function useLogTransactionErrors(states: QueryState[]): void {
  useEffect(() => {
    for (const state of states)
      if (state?.isError && state.error) console.error(state.error);
  }, [states]);
}

/** Exact precedence and labels from webpack 30335. */
export function getTransactionStatus({
  simulate,
  estimate,
  write,
  waitFor,
}: {
  simulate?: QueryState;
  estimate?: QueryState;
  write?: QueryState;
  waitFor?: QueryState;
}): TransactionStatus | null {
  if (waitFor?.isSuccess)
    return {
      displayText: "TX successful",
      isLoading: false,
      isError: false,
      isFinished: true,
    };
  if (waitFor?.isFetching)
    return {
      displayText: "Waiting for TX...",
      isLoading: true,
      isError: false,
      isFinished: false,
    };
  if (waitFor?.isError)
    return {
      displayText: "Error waiting for TX",
      isLoading: false,
      isError: true,
      isFinished: false,
    };
  if (write?.isError)
    return {
      displayText: "Wallet error...",
      isLoading: false,
      isError: false,
      isFinished: false,
    };
  if (write?.isPending)
    return {
      displayText: "Waiting for wallet...",
      isLoading: true,
      isError: false,
      isFinished: false,
    };
  if (write?.isSuccess)
    return {
      displayText: "TX broadcasted",
      isLoading: false,
      isError: false,
      isFinished: true,
    };
  if (simulate?.isFetching)
    return {
      displayText: "Simulating TX...",
      isLoading: true,
      isError: false,
      isFinished: false,
    };
  if (simulate?.isError)
    return {
      displayText: "Error simulating TX",
      isLoading: false,
      isError: true,
      isFinished: false,
    };
  if (!simulate?.isSuccess && estimate?.isFetching)
    return {
      displayText: "Estimating gas...",
      isLoading: true,
      isError: false,
      isFinished: false,
    };
  if (!simulate?.isSuccess && estimate?.isError)
    return {
      displayText: "Error estimating gas",
      isLoading: false,
      isError: true,
      isFinished: false,
    };
  return null;
}
