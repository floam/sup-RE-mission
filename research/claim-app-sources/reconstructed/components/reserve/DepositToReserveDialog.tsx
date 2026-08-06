"use client";

import { useEffect, useState } from "react";
import { erc20Abi, formatEther } from "viem";
import { useReadContract } from "wagmi";

import { APP_CHAIN } from "../../config/chains";
import { SUP_TOKEN_ADDRESS_BY_CHAIN } from "../../contracts/app-contracts";
import { useLocker } from "../../contexts/LockerContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useDepositToReserve } from "../../hooks/useDepositToReserve";
import { useTokenPrice } from "../../hooks/useTokenPrices";
import {
  formatTokenAmount,
  formatUsd,
  parseTokenAmount,
  sanitizeTokenInput,
} from "../../lib/format";
import { TransactionButton } from "../TransactionButton";

const DEBOUNCE_MS = 500;
const TRANSACTION_SUCCESS_DELAY = 3_000;

export function DepositToReserveDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose(): void;
}) {
  const [input, setInput] = useState("");
  const [approvalPending, setApprovalPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const { accountAddress, lockerAddress } = useLocker();
  const debounced = useDebouncedValue(input, DEBOUNCE_MS);
  const amount = debounced ? parseTokenAmount(debounced) : undefined;
  const token = SUP_TOKEN_ADDRESS_BY_CHAIN[APP_CHAIN.id];
  const { data: supPriceUSD } = useTokenPrice(APP_CHAIN.id, token);
  const { data: supBalance } = useReadContract({
    abi: erc20Abi,
    address: token,
    functionName: "balanceOf",
    chainId: APP_CHAIN.id,
    args: accountAddress ? [accountAddress] : undefined,
    query: { enabled: Boolean(accountAddress), refetchInterval: 60_000 },
  });
  const { approval, lock } = useDepositToReserve({
    accountAddress,
    lockerAddress,
    amount,
  });

  useEffect(() => {
    if (approval.isFinished) {
      setApprovalPending(true);
      approval.reset();
    }
  }, [approval]);

  useEffect(() => {
    if (approvalPending && !approval.needsApproval) setApprovalPending(false);
  }, [approval.needsApproval, approvalPending]);

  useEffect(() => {
    if (!lock.isFinished || lock.status?.isError || success) return;
    setInput("");
    setSuccess(true);
    const timer = window.setTimeout(() => {
      lock.reset();
      approval.reset();
      setSuccess(false);
      onClose();
    }, TRANSACTION_SUCCESS_DELAY);
    return () => window.clearTimeout(timer);
  }, [approval, lock, onClose, success]);

  useEffect(() => {
    if (!isOpen) {
      setInput("");
      setSuccess(false);
      lock.reset();
      approval.reset();
    }
  }, [approval, isOpen, lock]);

  if (!isOpen) return null;

  const balance = supBalance ?? 0n;
  const valid = Boolean(amount && amount > 0n && amount <= balance);
  const needsApproval = approval.needsApproval;
  const usdValue =
    amount && supPriceUSD
      ? formatUsd(Number(formatEther(amount)) * supPriceUSD)
      : "$0.00";

  return (
    <div className="wallet-dialog-overlay">
      <section
        role="dialog"
        aria-label="Deposit SUP in Reserve"
        className="wallet-dialog"
      >
        <p className="command-line">
          <span className="prompt">&gt;</span> deposit SUP{" "}
          <button type="button" aria-label="Close" onClick={onClose}>
            [ close ]
          </button>
        </p>
        <p>Deposit SUP into the Reserve for staking and liquidity use.</p>
        <label className="account-field">
          <span>amount</span>
          <input
            inputMode="decimal"
            placeholder="0"
            value={input}
            onChange={(event) =>
              setInput(sanitizeTokenInput(event.target.value))
            }
          />
        </label>
        <p className="dim">
          balance {formatTokenAmount(balance, 2)} SUP · value {usdValue} ·{" "}
          <button
            type="button"
            onClick={() => balance > 0n && setInput(formatEther(balance))}
            disabled={!balance}
          >
            max
          </button>
        </p>
        <p className="dim">
          Reserve SUP can later be withdrawn immediately with a community charge
          or streamed out over 12 months.
        </p>
        {success ? (
          <p className="positive">deposit confirmed</p>
        ) : (
          <TransactionButton
            dataTestId="deposit-to-reserve-button"
            chain={APP_CHAIN}
            onClick={needsApproval ? approval.approve : lock.lock}
            status={needsApproval ? approval.status : lock.status}
            ButtonProps={{ disabled: !valid }}
          >
            {needsApproval ? "[ approve SUP ]" : "[ deposit SUP ]"}
          </TransactionButton>
        )}
      </section>
    </div>
  );
}
