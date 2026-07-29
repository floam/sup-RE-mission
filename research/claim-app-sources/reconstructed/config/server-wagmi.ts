import { createConfig } from "@wagmi/core";
import { http } from "viem";
import { base } from "viem/chains";

import { ALCHEMY_RPC_URLS } from "./rpc";

export const serverWagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(ALCHEMY_RPC_URLS[base.id]),
  },
});
