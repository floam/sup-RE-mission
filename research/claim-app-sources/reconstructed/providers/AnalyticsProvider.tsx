"use client";

import { AnalyticsBrowser } from "@segment/analytics-next";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useFarcasterFrame } from "../contexts/FarcasterFrameProvider";
import { useWalletAccount } from "../hooks/useWalletAccount";

const isCypress =
  typeof window !== "undefined" &&
  Boolean((window as Window & { Cypress?: unknown }).Cypress);
let analyticsInstance: AnalyticsBrowser | null = null;

export function getAnalyticsBrowser(writeKey?: string) {
  if (!analyticsInstance) {
    analyticsInstance =
      !isCypress && writeKey
        ? AnalyticsBrowser.load({ writeKey }, { initialPageview: true })
        : AnalyticsBrowser.load({ writeKey: "NOOP" }, { disable: true });
    if (isCypress || !writeKey) {
      console.warn("Segment not initialized. No-op instance provided instead.");
    }
  }
  return analyticsInstance;
}

interface WalletAnalyticsState {
  isConnected: boolean;
  address?: string;
  connector?: string;
  connectorId?: string;
  network?: string;
  networkId?: number;
}

const DISCONNECTED_WALLET: WalletAnalyticsState = { isConnected: false };

function useWalletAnalytics(analyticsBrowser: AnalyticsBrowser) {
  const { connector, isConnected, address, chain } = useWalletAccount();
  const currentState = useMemo<WalletAnalyticsState>(
    () =>
      isConnected && connector && address
        ? {
            isConnected: true,
            address,
            connector: connector.name,
            connectorId: connector.id,
            ...(chain ? { network: chain.name, networkId: chain.id } : {}),
          }
        : DISCONNECTED_WALLET,
    [address, chain, connector, isConnected],
  );
  const [previousState, setPreviousState] =
    useState<WalletAnalyticsState>(DISCONNECTED_WALLET);

  useEffect(() => {
    if (currentState === previousState) return;
    if (currentState.isConnected !== previousState.isConnected) {
      if (currentState.isConnected) {
        void analyticsBrowser.track("Wallet Connected", currentState).then(() =>
          analyticsBrowser.identify(currentState.address!, {
            walletAddress: currentState.address,
          }),
        );
      } else {
        void analyticsBrowser
          .track("Wallet Disconnected", currentState)
          .then(() => analyticsBrowser.reset());
      }
    } else if (currentState.isConnected && previousState.isConnected) {
      if (currentState.networkId !== previousState.networkId) {
        void analyticsBrowser.track("Wallet Network Changed", currentState);
      }
      if (currentState.address !== previousState.address) {
        void analyticsBrowser
          .track("Wallet Account Changed", currentState)
          .then(() => analyticsBrowser.reset())
          .then(() =>
            analyticsBrowser.identify(currentState.address!, {
              walletAddress: currentState.address,
            }),
          );
      }
    }
    setPreviousState(currentState);
  }, [analyticsBrowser, currentState, previousState]);
}

function AnalyticsProviderInternal() {
  const analyticsBrowser = getAnalyticsBrowser(undefined);
  const pathname = usePathname();
  useWalletAnalytics(analyticsBrowser);
  useEffect(() => {
    void analyticsBrowser.page();
  }, [analyticsBrowser, pathname]);
  return null;
}

export function AnalyticsProvider() {
  const { isInMiniApp, isMiniAppLoading } = useFarcasterFrame();
  return isMiniAppLoading || isInMiniApp ? null : <AnalyticsProviderInternal />;
}
