"use client";

import { useBalance } from "wagmi";

import { useExpectedChains } from "../../contexts/ExpectedChainContext";
import { useWalletAccount } from "../../hooks/useWalletAccount";
import { formatTokenAmount } from "../../lib/format";
import { ConnectButton } from "./ConnectButton";

export function NavConnectAndBalance() {
  const { airdropChain } = useExpectedChains();
  const { address } = useWalletAccount();
  const balance = useBalance({ address, chainId: airdropChain.id });
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
