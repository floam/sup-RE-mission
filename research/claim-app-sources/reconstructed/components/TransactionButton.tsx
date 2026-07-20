"use client";

import { LoaderCircle } from "lucide-react";
import { useSwitchChain } from "wagmi";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Chain } from "viem";

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
    status?.isLoading || loading ? (
      <>
        <span className="invisible">.</span>
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        <span className="invisible">.</span>
      </>
    ) : requiresChainSwitch ? (
      `Switch Chain to ${chain.name}`
    ) : (
      children
    );

  return (
    <div
      className={`flex w-full flex-col items-center space-y-2 ${className ?? ""}`}
    >
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
      {status?.isError && <p className="text-sm">{status.displayText}</p>}
    </div>
  );
}
