"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Chain } from "viem";
import { useSwitchChain } from "wagmi";

import { useWalletAccount } from "../hooks/useWalletAccount";
import type { TransactionStatus } from "../types/transactions";

export interface TransactionButtonProps {
  children: ReactNode;
  chain: Chain;
  status?: TransactionStatus | null;
  dataTestId?: string;
  className?: string;
  onClick(): void;
  ButtonProps?: ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    variant?: "default" | "outline" | "ghost";
  };
}

export function TransactionButton({
  children,
  chain,
  status,
  dataTestId,
  className,
  onClick,
  ButtonProps = {},
}: TransactionButtonProps) {
  const { switchChain } = useSwitchChain();
  const { isConnected, chainId, isSynced } = useWalletAccount();
  const requiresChainSwitch =
    !globalThis.navigator?.webdriver &&
    isSynced &&
    isConnected &&
    chain.id !== chainId;
  const canSwitch = requiresChainSwitch && Boolean(switchChain);
  const { disabled, loading, variant, ...buttonProps } = ButtonProps;
  const isDisabled =
    !canSwitch && (!isConnected || status?.isFinished || disabled);

  const label =
    status?.isLoading || loading
      ? `[ ${status?.displayText || "working…"} ]`
      : requiresChainSwitch
        ? `[ switch to ${chain.name} ]`
        : children;

  return (
    <span className={className}>
      <button
        data-testid={dataTestId}
        data-variant={variant}
        disabled={Boolean(isDisabled)}
        {...buttonProps}
        onClick={() =>
          requiresChainSwitch ? switchChain?.({ chainId: chain.id }) : onClick()
        }
      >
        {label}
      </button>
      {status?.isError && (
        <span className="negative" role="alert">
          {" "}{status.displayText}
        </span>
      )}
    </span>
  );
}
