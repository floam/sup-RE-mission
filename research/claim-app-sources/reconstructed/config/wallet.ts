"use client";

import {
  coinbaseWallet,
  injected,
  safe,
  walletConnect,
} from "wagmi/connectors";
import { createConfig, http } from "wagmi";

import { APP_CHAIN } from "./chains";
import { farcasterMiniApp } from "./farcaster-connector";
import { ALCHEMY_RPC_URLS } from "./rpc";

const WALLETCONNECT_PROJECT_ID = "8fcff23b035b115b5c1324ad717589ab";

export const wagmiConfig = createConfig({
  chains: [APP_CHAIN],
  connectors: [
    farcasterMiniApp(),
    injected(),
    coinbaseWallet({ appName: "Superfluid Claim App" }),
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      metadata: {
        name: "Superfluid Claim App",
        description: "Earn SUP every second by using Superfluid-powered apps.",
        url: "https://claim.superfluid.org",
        icons: [],
      },
    }),
    safe(),
  ],
  transports: {
    [APP_CHAIN.id]: http(ALCHEMY_RPC_URLS[APP_CHAIN.id]),
  },
});
