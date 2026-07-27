import type { NextConfig } from "next";

const config: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/clearmacro-provider/:path*",
        destination: "https://clearmacro-provider.superfluid.dev/:path*",
      },
    ];
  },
};

export default config;
