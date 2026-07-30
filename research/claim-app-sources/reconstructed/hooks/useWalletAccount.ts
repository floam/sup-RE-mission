"use client";

import { isAddress } from "viem";
import { useAccount } from "wagmi";

import { useFarcasterFrame } from "../contexts/FarcasterFrameProvider";
import { ZERO_ADDRESS } from "../contracts/app-contracts";
import type { Address } from "../types/program-app";

/** Canonical account facade recovered from webpack 32224. */
export function useWalletAccount() {
  const wagmi = useAccount();
  const { isMiniAppLoading } = useFarcasterFrame();
  const candidateAddress = wagmi.address;
  const normalizedAddress = candidateAddress?.toLowerCase();
  const address =
    normalizedAddress &&
    normalizedAddress !== ZERO_ADDRESS &&
    isAddress(normalizedAddress)
      ? (normalizedAddress as Address)
      : undefined;
  const isConnecting = isMiniAppLoading || wagmi.isConnecting;
  const isReconnecting = isMiniAppLoading || wagmi.isReconnecting;
  const isConnected = wagmi.isConnected && Boolean(address);

  return {
    address,
    isConnected,
    isConnecting,
    isReconnecting,
    chain: wagmi.chain,
    chainId: wagmi.chainId,
    isSyncing: isMiniAppLoading || wagmi.isReconnecting,
    isSynced: !isMiniAppLoading && !wagmi.isReconnecting,
    connector: wagmi.connector,
  };
}
