"use client";

import { useBalance } from "wagmi";

import { APP_CHAIN } from "../../config/chains";
import { useWalletAccount } from "../../hooks/useWalletAccount";
import { formatTokenAmount } from "../../lib/format";
import { ConnectButton } from "./ConnectButton";

export function NavConnectAndBalance() {
  const { address } = useWalletAccount();
  const balance = useBalance({ address, chainId: APP_CHAIN.id });
  return (
    <div className="flex items-center gap-3">
      <div>
        {balance.data && (
          <span data-testid="nav-balance" className="hidden lg:block">
            <img
              src="/eth.svg"
              alt="ETH Icon"
              className="-mt-1 mr-1 inline-block h-4 w-4"
            />
            {formatTokenAmount(balance.data.value, 3)} ETH
          </span>
        )}
      </div>
      <ConnectButton />
    </div>
  );
}
