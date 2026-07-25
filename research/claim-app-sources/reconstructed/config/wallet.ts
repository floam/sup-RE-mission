"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { base, baseSepolia } from "@reown/appkit/networks";

import {
  APP_KIT_FEATURES,
  APP_KIT_THEME,
  APP_METADATA,
  CUSTOM_RPC_URLS,
  REOWN_PROJECT_ID,
} from "./app-kit";

const networks = [base, baseSepolia] as [typeof base, typeof baseSepolia];
const customRpcUrls = {
  [`eip155:${base.id}`]: [...CUSTOM_RPC_URLS[`eip155:${base.id}`]],
  [`eip155:${baseSepolia.id}`]: [
    ...CUSTOM_RPC_URLS[`eip155:${baseSepolia.id}`],
  ],
};
export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId: REOWN_PROJECT_ID,
  customRpcUrls,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId: REOWN_PROJECT_ID,
  metadata: { ...APP_METADATA, icons: [...APP_METADATA.icons] },
  customRpcUrls,
  features: APP_KIT_FEATURES,
  themeMode: APP_KIT_THEME.themeMode,
  themeVariables: APP_KIT_THEME.themeVariables,
});
