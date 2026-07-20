"use client";

import { createContext, useContext, type PropsWithChildren } from "react";
import { useAppKitAccount } from "@reown/appkit/react";

import { useFarcasterFrame } from "./FarcasterFrameProvider";

type AppKitAccount = ReturnType<typeof useAppKitAccount>;

const DISCONNECTED_APP_KIT_ACCOUNT = {
  address: undefined,
  isConnected: false,
  status: "disconnected",
  allAccounts: [],
  caipAddress: undefined,
} as AppKitAccount;

const AppKitAccountContext = createContext<AppKitAccount>(
  DISCONNECTED_APP_KIT_ACCOUNT,
);

function AppKitAccountInnerProvider({ children }: PropsWithChildren) {
  const account = useAppKitAccount();
  return (
    <AppKitAccountContext.Provider value={account}>
      {children}
    </AppKitAccountContext.Provider>
  );
}

export function AppKitAccountProvider({ children }: PropsWithChildren) {
  const { isInMiniApp, isMiniAppLoading } = useFarcasterFrame();
  const shouldUseAppKit = !isMiniAppLoading && !isInMiniApp;
  return shouldUseAppKit ? (
    <AppKitAccountInnerProvider>{children}</AppKitAccountInnerProvider>
  ) : (
    <AppKitAccountContext.Provider value={DISCONNECTED_APP_KIT_ACCOUNT}>
      {children}
    </AppKitAccountContext.Provider>
  );
}

export function useAppKitAccountSafe(): AppKitAccount {
  return useContext(AppKitAccountContext);
}
