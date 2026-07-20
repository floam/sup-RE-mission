"use client";

import confetti from "canvas-confetti";
import { useEffect, useState } from "react";
import { formatEther, erc20Abi } from "viem";
import { useReadContract } from "wagmi";

import { useExpectedChains } from "../../contexts/ExpectedChainContext";
import { useLocker } from "../../contexts/LockerContext";
import { SUP_TOKEN_ADDRESS_BY_CHAIN } from "../../contracts/app-contracts";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useDepositToReserve } from "../../hooks/useDepositToReserve";
import { useTokenPrice } from "../../hooks/useTokenPrices";
import {
  parseTokenAmount,
  sanitizeTokenInput,
  formatTokenAmount,
  formatUsd,
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
  const { airdropChain } = useExpectedChains();
  const debounced = useDebouncedValue(input, DEBOUNCE_MS);
  const amount = debounced ? parseTokenAmount(debounced) : undefined;
  const token = SUP_TOKEN_ADDRESS_BY_CHAIN[airdropChain.id];
  const { data: supPriceUSD } = useTokenPrice(airdropChain.id, token);
  const { data: supBalance } = useReadContract({
    abi: erc20Abi,
    address: token,
    functionName: "balanceOf",
    chainId: airdropChain.id,
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
    void confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#22c55e", "#10b981", "#34d399"],
    });
    const timer = setTimeout(() => {
      lock.reset();
      approval.reset();
      setSuccess(false);
      onClose();
    }, TRANSACTION_SUCCESS_DELAY);
    return () => clearTimeout(timer);
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
  return (
    <div
      role="dialog"
      aria-label="Deposit to Earn"
      className="modal max-w-4xl bg-gradient-to-t from-green-pale via-platinum-light to-platinum p-4 sm:p-6"
    >
      <button aria-label="Close" onClick={onClose}>
        ×
      </button>
      <div className="space-y-6 rounded-lg bg-white p-6">
        <div className="text-center">
          <h2 className="mb-2 text-title3">Deposit to Earn</h2>
          <p className="text-alto text-base uppercase">
            Deposit SUP in your Reserve to start earning rewards.
          </p>
        </div>
        <div className="flex items-start justify-between rounded-lg border border-platinum bg-[#F7F8FA] p-4">
          <div className="flex flex-1 flex-col">
            <div className="flex items-center gap-2">
              <input
                inputMode="decimal"
                placeholder="0"
                value={input}
                onChange={(event) =>
                  setInput(sanitizeTokenInput(event.target.value))
                }
              />
              <button
                onClick={() => balance > 0n && setInput(formatEther(balance))}
                disabled={!balance}
              >
                MAX
              </button>
            </div>
            <div className="text-gray-500 text-sm">
              {amount && supPriceUSD
                ? formatUsd(Number(formatEther(amount)) * supPriceUSD)
                : "$0.00"}
            </div>
          </div>
          <div className="text-right">
            <strong>SUP</strong>
            <div>{formatTokenAmount(balance, 2)} SUP</div>
          </div>
        </div>
        <p className="text-center text-gray-600 text-sm">
          After depositing SUP in your Reserve you can earn Staking and
          Liquidity Provision rewards. Your SUP locked in a Reserve can be
          withdraw in a stream over 12 months or you can get a portion of it
          back instantly.
        </p>
        {success ? (
          <button onClick={onClose}>Done</button>
        ) : (
          <TransactionButton
            dataTestId="deposit-to-reserve-button"
            chain={airdropChain}
            onClick={needsApproval ? approval.approve : lock.lock}
            status={needsApproval ? approval.status : lock.status}
            ButtonProps={{ disabled: !valid, className: "w-full" }}
          >
            {needsApproval ? "Approve SUP" : "Deposit SUP"}
          </TransactionButton>
        )}
      </div>
    </div>
  );
}
