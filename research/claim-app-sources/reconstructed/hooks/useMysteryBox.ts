"use client";

import { useCallback } from "react";
import { encodeFunctionData, parseEther } from "viem";
import {
  useEstimateGas,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { useExpectedChains } from "../contexts/ExpectedChainContext";
import { MYSTERY_BOX_ADDRESS, mysteryBoxAbi } from "../contracts/app-contracts";
import { API_ENDPOINTS } from "../lib/endpoints";
import type { Address } from "../types/program-app";
import type {
  MysteryBoxCheck,
  MysteryBoxResult,
  PendingMysteryBoxClaim,
} from "../types/campaign-rewards";
import {
  getTransactionStatus,
  useLogTransactionErrors,
} from "./useTransactionStatus";

export const MYSTERY_BOX_CLAIM_COST = parseEther("0.0001");
export const MYSTERY_BOX_PENDING_CLAIM_KEY = "mystery-box-pending-claim";

export async function checkMysteryBox(
  address: Address,
): Promise<MysteryBoxCheck> {
  try {
    const response = await fetch(API_ENDPOINTS.mysteryBoxCheck(address));
    const body = (await response.json()) as Omit<MysteryBoxCheck, "success"> & {
      error?: string;
    };
    return { ...body, success: body.error === undefined };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      activePrograms: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function claimMysteryBoxPoints(
  address: Address,
  transactionHash: `0x${string}`,
): Promise<MysteryBoxResult> {
  try {
    const response = await fetch(API_ENDPOINTS.mysteryBoxClaim, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, transactionHash }),
    });
    const body = (await response.json()) as MysteryBoxResult;
    return body.error
      ? { success: false, error: body.error }
      : { ...body, success: true };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function readPendingMysteryBoxClaim(
  address?: Address,
): PendingMysteryBoxClaim | null {
  if (!address) return null;
  try {
    const value = localStorage.getItem(
      `${MYSTERY_BOX_PENDING_CLAIM_KEY}-${address.toLowerCase()}`,
    );
    return value ? (JSON.parse(value) as PendingMysteryBoxClaim) : null;
  } catch {
    return null;
  }
}

export function writePendingMysteryBoxClaim(
  address: Address | undefined,
  claim: PendingMysteryBoxClaim | null,
) {
  if (!address) return;
  try {
    const key = `${MYSTERY_BOX_PENDING_CLAIM_KEY}-${address.toLowerCase()}`;
    claim
      ? localStorage.setItem(key, JSON.stringify(claim))
      : localStorage.removeItem(key);
  } catch {
    /* Storage is optional in embedded browsers. */
  }
}

export function useMysteryBoxOpen(accountAddress?: Address) {
  const { airdropChain } = useExpectedChains();
  const address = MYSTERY_BOX_ADDRESS[airdropChain.id];
  const enabled = Boolean(accountAddress && address);
  const simulate = useSimulateContract({
    abi: mysteryBoxAbi,
    address,
    functionName: "open",
    chainId: airdropChain.id,
    value: MYSTERY_BOX_CLAIM_COST,
    query: { enabled },
    stateOverride: accountAddress
      ? [{ address: accountAddress, balance: parseEther("100") }]
      : undefined,
  });
  const request = simulate.data?.request;
  const estimate = useEstimateGas({
    chainId: airdropChain.id,
    to: request?.address,
    data: request
      ? encodeFunctionData({ abi: mysteryBoxAbi, functionName: "open" })
      : undefined,
    value: MYSTERY_BOX_CLAIM_COST,
    query: { enabled: Boolean(request && enabled) },
  });
  const write = useWriteContract();
  const waitFor = useWaitForTransactionReceipt({
    chainId: airdropChain.id,
    hash: write.data,
    query: { enabled: Boolean(write.data) },
  });
  const open = useCallback(() => {
    if (!request) {
      if (simulate.error) console.error(simulate.error);
      console.error("Error! No transaction simulation data available.");
      return;
    }
    write.writeContract({ ...request, gas: estimate.data });
  }, [estimate.data, request, simulate.error, write]);
  useLogTransactionErrors([simulate, estimate, write, waitFor]);
  return {
    simulateMysteryBoxOpen: simulate,
    estimateOpen: estimate,
    writeMysteryBoxOpen: write,
    waitForTransactionOpen: waitFor,
    isFinished: write.isSuccess && waitFor.isSuccess,
    open,
    status: getTransactionStatus({ simulate, estimate, write, waitFor }),
    reset: write.reset,
    txHash: write.data,
  };
}
