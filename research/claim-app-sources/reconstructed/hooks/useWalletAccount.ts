"use client";

import { isAddress } from "viem";
import { useAccount } from "wagmi";

import { useAppKitAccountSafe } from "../contexts/AppKitAccountContext";
import { useFarcasterFrame } from "../contexts/FarcasterFrameProvider";
import { useWalletSync } from "../contexts/WalletSyncContext";
import { ZERO_ADDRESS } from "../contracts/app-contracts";
import type { Address } from "../types/program-app";

/** Canonical account facade recovered from webpack 32224. */
export function useWalletAccount() {
  const wagmi = useAccount();
  const appKit = useAppKitAccountSafe();
  const { isInMiniApp, isMiniAppLoading } = useFarcasterFrame();
  const { isSyncing, isSynced, chainId } = useWalletSync();
  const candidateAddress = isInMiniApp ? wagmi.address : appKit.address;
  const normalizedAddress = candidateAddress?.toLowerCase();
  const address =
    normalizedAddress &&
    normalizedAddress !== ZERO_ADDRESS &&
    isAddress(normalizedAddress)
      ? (normalizedAddress as Address)
      : undefined;
  const isConnecting =
    isMiniAppLoading ||
    (isInMiniApp && wagmi.isConnecting) ||
    appKit.status === "connecting";
  const isReconnecting =
    isMiniAppLoading ||
    (isInMiniApp && wagmi.isReconnecting) ||
    appKit.status === "reconnecting";
  const isConnected =
    ((isInMiniApp && wagmi.isConnected) || appKit.status === "connected") &&
    Boolean(address);

  return {
    address,
    isConnected,
    isConnecting,
    isReconnecting,
    chain: wagmi.chain,
    chainId,
    isSyncing,
    isSynced,
    connector: wagmi.connector,
  };
}
