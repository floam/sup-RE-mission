"use client";

import {
  isServer,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";
import type { PropsWithChildren } from "react";

import { AppKitAccountProvider } from "../contexts/AppKitAccountContext";
import { ExpectedChainProvider } from "../contexts/ExpectedChainContext";
import {
  FarcasterFrameProvider,
  useFarcasterFrame,
} from "../contexts/FarcasterFrameProvider";
import { LockerProvider } from "../contexts/LockerContext";
import { WalletSyncProvider } from "../contexts/WalletSyncContext";
import { AnalyticsProvider } from "./AnalyticsProvider";
import { AutoConnectFarcaster } from "./AutoConnectFarcaster";
import { BonusModalProvider } from "./BonusModalProvider";
import { DailyMysteryBoxProvider } from "./DailyMysteryBoxProvider";
import { GoodDollarProvider } from "./GoodDollarProvider";
import { ReferralHandler } from "./ReferralHandler";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 15_000 }, mutations: {} },
  });
}

let browserQueryClient: QueryClient | undefined;
export function getQueryClient() {
  if (isServer) return createQueryClient();
  browserQueryClient ??= createQueryClient();
  return browserQueryClient;
}

/**
 * `wagmiConfig` is kept as an explicit boundary because the recovered adapter's
 * full production-network list and Farcaster connector are third-party config
 * objects. All observable first-party adapter options live in config/app-kit.ts.
 */
export function ContextProvider({
  children,
  cookies,
  wagmiConfig,
}: PropsWithChildren<{
  cookies?: string | null;
  wagmiConfig: Config;
}>) {
  const bonusModalEnabled =
    process.env.NEXT_PUBLIC_DISABLE_BONUS_MODAL !== "true";
  const initialState = cookieToInitialState(wagmiConfig, cookies ?? undefined);
  return (
    <QueryClientProvider client={getQueryClient()}>
      <WagmiProvider
        config={wagmiConfig}
        initialState={initialState}
        reconnectOnMount
      >
        <FarcasterFrameProvider>
          <AppKitAccountProvider>
            <ConditionalWalletComponents>
              <WalletSyncProvider>
                <ExpectedChainProvider>
                  <LockerProvider>
                    {children}
                    <AnalyticsProvider />
                    <GoodDollarProvider />
                    <ReferralHandler />
                    <DailyMysteryBoxProvider />
                    {bonusModalEnabled && <BonusModalProvider />}
                  </LockerProvider>
                </ExpectedChainProvider>
              </WalletSyncProvider>
            </ConditionalWalletComponents>
          </AppKitAccountProvider>
        </FarcasterFrameProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

function ConditionalWalletComponents({ children }: PropsWithChildren) {
  const { isInMiniApp } = useFarcasterFrame();
  return (
    <>
      {isInMiniApp && <AutoConnectFarcaster />}
      {children}
    </>
  );
}
