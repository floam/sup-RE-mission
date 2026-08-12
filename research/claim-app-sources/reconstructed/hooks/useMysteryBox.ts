"use client";

import { encodeFunctionData, parseEther } from "viem";
import { useEstimateGas, useReadContract, useSimulateContract } from "wagmi";

import { APP_CHAIN } from "../config/chains";
import { MYSTERY_BOX_ADDRESS, mysteryBoxAbi } from "../contracts/app-contracts";
import { API_ENDPOINTS } from "../lib/endpoints";
import type { Address } from "../types/program-app";
import type {
  MysteryBoxCheck,
  MysteryBoxResult,
  PendingMysteryBoxClaim,
} from "../types/campaign-rewards";
import { useContractTransaction } from "./useContractTransaction";

export const MYSTERY_BOX_CLAIM_COST = parseEther("0.0001");
export const MYSTERY_BOX_PENDING_CLAIM_KEY = "mystery-box-pending-claim";

export async function checkMysteryBox(
  address: Address,
): Promise<MysteryBoxCheck> {
  const response = await fetch(API_ENDPOINTS.mysteryBoxCheck(address));
  const body = (await response.json()) as Omit<MysteryBoxCheck, "success"> & {
    error?: string;
  };
  if (!response.ok)
    throw new Error(body.error ?? `Mystery box check failed (${response.status})`);
  return { ...body, success: body.error === undefined };
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
  const address = MYSTERY_BOX_ADDRESS[APP_CHAIN.id];
  const enabled = Boolean(accountAddress && address);
  const simulate = useSimulateContract({
    abi: mysteryBoxAbi,
    address,
    functionName: "open",
    chainId: APP_CHAIN.id,
    value: MYSTERY_BOX_CLAIM_COST,
    query: { enabled },
    stateOverride: accountAddress
      ? [{ address: accountAddress, balance: parseEther("100") }]
      : undefined,
  });
  const request = simulate.data?.request;
  const estimate = useEstimateGas({
    chainId: APP_CHAIN.id,
    to: request?.address,
    data: request
      ? encodeFunctionData({ abi: mysteryBoxAbi, functionName: "open" })
      : undefined,
    value: MYSTERY_BOX_CLAIM_COST,
    query: { enabled: Boolean(request && enabled) },
  });
  const transaction = useContractTransaction({
    request,
    gas: estimate.data,
    simulate,
    estimate,
  });
  const { write, waitFor, execute: open } = transaction;
  return {
    simulateMysteryBoxOpen: simulate,
    estimateOpen: estimate,
    writeMysteryBoxOpen: write,
    waitForTransactionOpen: waitFor,
    isFinished:
      write.isSuccess &&
      waitFor.isSuccess &&
      waitFor.data?.status === "success",
    isReverted:
      waitFor.isSuccess && waitFor.data?.status === "reverted",
    open,
    status: transaction.status,
    reset: write.reset,
    txHash: write.data,
  };
}

export function useMysteryBoxLastClaim(accountAddress?: Address) {
  const address = MYSTERY_BOX_ADDRESS[APP_CHAIN.id];
  return useReadContract({
    abi: mysteryBoxAbi,
    address,
    functionName: "lastClaimTime",
    args: accountAddress ? [accountAddress] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: Boolean(accountAddress && address) },
  });
}
