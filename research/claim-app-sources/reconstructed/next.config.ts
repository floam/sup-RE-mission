import type { NextConfig } from "next";

const CLAIM_API_ORIGIN = "https://claim.superfluid.org";

const config: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/leaderboard/:path*",
        destination: `${CLAIM_API_ORIGIN}/api/leaderboard/:path*`,
      },
      {
        source: "/api/delegates/:path*",
        destination: `${CLAIM_API_ORIGIN}/api/delegates/:path*`,
      },
      {
        source: "/api/mystery-box/:path*",
        destination: `${CLAIM_API_ORIGIN}/api/mystery-box/:path*`,
      },
      {
        source: "/api/bonus-flows/:path*",
        destination: `${CLAIM_API_ORIGIN}/api/bonus-flows/:path*`,
      },
    ];
  },
};

export default config;
