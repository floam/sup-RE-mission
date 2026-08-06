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
    <span>
      {balance.data && (
        <span data-testid="nav-balance">
          {formatTokenAmount(balance.data.value, 3)} ETH{" "}
        </span>
      )}
      <ConnectButton />
    </span>
  );
}
