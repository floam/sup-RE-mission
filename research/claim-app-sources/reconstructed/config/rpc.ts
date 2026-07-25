/**
 * Alchemy endpoints supplied for the recovered app deployment. The public key is
 * intentionally browser-visible because wallet chain metadata consumes these URLs.
 */
export const ALCHEMY_API_KEY =
  process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? "xn7PYKk2hrDMxsCtaYPcn";

export const ALCHEMY_RPC_URLS = {
  8453: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  84532: `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
} as const;

export function getAlchemyRpcUrl(chainId: keyof typeof ALCHEMY_RPC_URLS) {
  return ALCHEMY_RPC_URLS[chainId];
}
