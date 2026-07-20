"use client";

import {
  useAppKitAccount,
  useAppKitNetwork,
  useAppKitState,
  useDisconnect as useAppKitDisconnect,
} from "@reown/appkit/react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useAccount, useDisconnect as useWagmiDisconnect } from "wagmi";

import { useFarcasterFrame } from "./FarcasterFrameProvider";

interface WalletSyncState {
  isSyncing: boolean;
  isSynced: boolean;
  chainId?: number;
}

const WalletSyncContext = createContext<WalletSyncState>({
  isSyncing: true,
  isSynced: false,
  chainId: undefined,
});

export function WalletSyncProvider({ children }: PropsWithChildren) {
  const { isInMiniApp, isMiniAppLoading } = useFarcasterFrame();
  const shouldUseAppKit = !isMiniAppLoading && !isInMiniApp;
  return shouldUseAppKit ? (
    <AppKitSyncProvider>{children}</AppKitSyncProvider>
  ) : (
    <WagmiOnlySyncProvider>{children}</WagmiOnlySyncProvider>
  );
}

function WagmiOnlySyncProvider({ children }: PropsWithChildren) {
  const { chain, isReconnecting } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const value = useMemo(
    () => ({
      isSyncing: !mounted || isReconnecting,
      isSynced: mounted || !isReconnecting,
      chainId: chain?.id,
    }),
    [chain?.id, isReconnecting, mounted],
  );
  return (
    <WalletSyncContext.Provider value={value}>
      {children}
    </WalletSyncContext.Provider>
  );
}

function AppKitSyncProvider({ children }: PropsWithChildren) {
  const { chain } = useAccount();
  const { chainId } = useAppKitNetwork();
  const { initialized, loading } = useAppKitState();
  const { status, isConnected } = useAppKitAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const appKitChainId = chainId == null ? undefined : Number(chainId);
  const isAppKitReady =
    mounted &&
    initialized &&
    !loading &&
    status !== "connecting" &&
    status !== "reconnecting";
  const chainsMatch =
    !appKitChainId || !chain?.id || appKitChainId === chain.id;

  useRecoverFromChainMismatch({
    isAppKitReady,
    chainsMatch,
    appKitIsConnected: isConnected,
  });
  useRecoverFromConfusedConnection({
    isAppKitReady,
    appKitIsConnected: isConnected,
    appKitStatus: status,
  });
  useRecoverFromStuckAppKit({
    initialized,
    loading,
    isConnecting: status === "connecting",
    isReconnecting: status === "reconnecting",
  });

  const value = useMemo(
    () => ({
      isSyncing: !isAppKitReady || !chainsMatch,
      isSynced: isAppKitReady && chainsMatch,
      chainId: appKitChainId ?? chain?.id,
    }),
    [appKitChainId, chain?.id, chainsMatch, isAppKitReady],
  );
  return (
    <WalletSyncContext.Provider value={value}>
      {children}
    </WalletSyncContext.Provider>
  );
}

function useRecoverFromChainMismatch({
  isAppKitReady,
  chainsMatch,
  appKitIsConnected,
}: {
  isAppKitReady: boolean;
  chainsMatch: boolean;
  appKitIsConnected: boolean;
}) {
  const { disconnect: disconnectWagmi } = useWagmiDisconnect();
  const { disconnect: disconnectAppKit } = useAppKitDisconnect();
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);
  useEffect(() => {
    if (
      !isAppKitReady ||
      chainsMatch ||
      recoveryAttempted ||
      !appKitIsConnected
    )
      return;
    const timer = setTimeout(() => {
      console.warn(
        "Chain state mismatch between wagmi and AppKit. Disconnecting to recover...",
      );
      disconnectAppKit();
      disconnectWagmi();
      setRecoveryAttempted(true);
    }, 3_000);
    return () => clearTimeout(timer);
  }, [
    appKitIsConnected,
    chainsMatch,
    disconnectAppKit,
    disconnectWagmi,
    isAppKitReady,
    recoveryAttempted,
  ]);
}

function useRecoverFromConfusedConnection({
  isAppKitReady,
  appKitIsConnected,
  appKitStatus,
}: {
  isAppKitReady: boolean;
  appKitIsConnected: boolean;
  appKitStatus: string;
}) {
  const { disconnect: disconnectWagmi } = useWagmiDisconnect();
  const { disconnect: disconnectAppKit } = useAppKitDisconnect();
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);
  useEffect(() => {
    if (
      !isAppKitReady ||
      recoveryAttempted ||
      !appKitIsConnected ||
      appKitStatus !== "disconnected"
    )
      return;
    const timer = setTimeout(() => {
      console.warn(
        "AppKit's internal connection state is confused. Disconnecting...",
      );
      disconnectAppKit();
      disconnectWagmi();
      setRecoveryAttempted(true);
    }, 1_000);
    return () => clearTimeout(timer);
  }, [
    appKitIsConnected,
    appKitStatus,
    disconnectAppKit,
    disconnectWagmi,
    isAppKitReady,
    recoveryAttempted,
  ]);
}

function useRecoverFromStuckAppKit({
  initialized,
  loading,
  isConnecting,
  isReconnecting,
}: {
  initialized: boolean;
  loading: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
}) {
  const { disconnect: disconnectWagmi } = useWagmiDisconnect();
  const { disconnect: disconnectAppKit } = useAppKitDisconnect();
  const isStuck = !initialized && !loading && !isConnecting && !isReconnecting;
  useEffect(() => {
    if (!isStuck) return;
    const timer = setTimeout(() => {
      console.warn(
        "AppKit stuck in loading state for 15 seconds. Disconnecting...",
      );
      disconnectAppKit();
      disconnectWagmi();
    }, 15_000);
    return () => clearTimeout(timer);
  }, [disconnectAppKit, disconnectWagmi, isStuck]);
}

export function useWalletSync(): WalletSyncState {
  return useContext(WalletSyncContext);
}
