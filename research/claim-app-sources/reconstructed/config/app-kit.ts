import { base, baseSepolia } from "@reown/appkit/networks";

export const REOWN_PROJECT_ID = "8fcff23b035b115b5c1324ad717589ab";

export const APP_METADATA = {
  name: "Superfluid Claim App",
  description: "Earn SUP every second by using Superfluid-powered apps.",
  url: "https://claim.superfluid.org",
  icons: [
    "https://wrpcd.net/cdn-cgi/imagedelivery/BXluQx4ige9GuW0Ia56BHw/6153aa84-2b85-43e2-de05-a4513aab4d00/anim=false,fit=contain,f=auto,w=32",
  ],
} as const;

export const CUSTOM_RPC_URLS = {
  [`eip155:${base.id}`]: [
    { url: "https://rpc-endpoints.superfluid.dev/base-mainnet" },
  ],
  [`eip155:${baseSepolia.id}`]: [
    { url: "https://rpc-endpoints.superfluid.dev/base-sepolia" },
  ],
} as const;

export const SAFE_CONNECTOR_OPTIONS = {
  allowedDomains: [
    /app\.safe\.global$/,
    /^https:\/\/(?:[^/]+\.)?coinshift\.xyz$/,
  ],
  debug: false,
  shimDisconnect: true,
} as const;

export const APP_KIT_FEATURES = {
  analytics: false,
  email: false,
  socials: false,
} as const;

export const APP_KIT_THEME = {
  themeMode: "light" as const,
  themeVariables: {
    "--w3m-accent": "#006622",
    "--w3m-font-family": "var(--font-gt-walsheim)",
  },
};
