"use client";

import { useCallback } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { APP_CHAIN } from "../config/chains";
import {
  getTransactionStatus,
  useLogTransactionErrors,
  type QueryState,
} from "./useTransactionStatus";

type WriteRequest = Parameters<
  ReturnType<typeof useWriteContract>["writeContract"]
>[0];

/** Shared wallet-write, receipt, error, and status lifecycle for prepared calls. */
export function useContractTransaction({
  request,
  gas,
  simulate,
  estimate,
  enabled = true,
}: {
  request?: WriteRequest;
  gas?: bigint;
  simulate: QueryState;
  estimate: QueryState;
  enabled?: boolean;
}) {
  const write = useWriteContract();
  const waitFor = useWaitForTransactionReceipt({
    chainId: APP_CHAIN.id,
    hash: write.data,
    query: { enabled: enabled && Boolean(write.data) },
  });
  const execute = useCallback(() => {
    if (!request) {
      if (simulate.error) console.error(simulate.error);
      console.error("Error! No transaction simulation data available.");
      return;
    }
    write.writeContract({ ...request, gas });
  }, [gas, request, simulate.error, write]);

  useLogTransactionErrors([simulate, estimate, write, waitFor]);
  return {
    write,
    waitFor,
    execute,
    hash: write.data,
    status: getTransactionStatus({ simulate, estimate, write, waitFor }),
  };
}
