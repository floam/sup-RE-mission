"use client";

import confetti from "canvas-confetti";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatEther } from "viem";

import { useExpectedChains } from "../../contexts/ExpectedChainContext";
import { useLocker } from "../../contexts/LockerContext";
import {
  MIN_UNLOCK_AMOUNT,
  SUP_TOKEN_ADDRESS_BY_CHAIN,
} from "../../contracts/app-contracts";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useFontaines } from "../../hooks/useFontaines";
import { useLockerBalance } from "../../hooks/useLockerBalance";
import { useLockerUnlock } from "../../hooks/useLockerUnlock";
import { useRecentTransactions } from "../../hooks/useRecentTransactions";
import {
  formatTokenAmount,
  parseTokenAmount,
  sanitizeTokenInput,
} from "../../lib/format";
import { TransactionButton } from "../TransactionButton";
import { FontaineListItem } from "./FontaineListItem";

type WithdrawMode = "drain" | "stream";

export function WithdrawFromReserveDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose(): void;
}) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<WithdrawMode>("drain");
  const [showStreams, setShowStreams] = useState(false);
  const [selectedFontaine, setSelectedFontaine] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const didCelebrate = useRef(false);
  const { accountAddress, lockerAddress } = useLocker();
  const { airdropChain } = useExpectedChains();
  const debounced = useDebouncedValue(input, 500);
  const amount = debounced ? parseTokenAmount(debounced) : undefined;
  const lockerBalance = useLockerBalance({ lockerAddress });
  const availableBalance = lockerBalance.data?.availableBalance;
  const fontainesQuery = useFontaines(lockerAddress);
  const fontaines = fontainesQuery.data?.fontaines ?? [];
  const recentStreams = useRecentTransactions(
    "stream-withdrawn-from-reserve",
    10,
  );
  const recentTimestamp = recentStreams[0]?.timestamp;
  const isWaitingForIndex = recentStreams.length > 0;
  const hasStreams =
    Boolean(fontainesQuery.data?.hasFontaines) || isWaitingForIndex;
  const drain = useLockerUnlock({
    accountAddress,
    lockerAddress,
    unlockPeriodDays: 0,
    amount: mode === "drain" ? amount : undefined,
  });
  const stream = useLockerUnlock({
    accountAddress,
    lockerAddress,
    unlockPeriodDays: 365,
    amount: mode === "stream" ? amount : undefined,
  });
  const activeTransaction = mode === "drain" ? drain : stream;
  const drainReset = drain.reset;
  const streamReset = stream.reset;

  useEffect(() => {
    if (
      !activeTransaction.isFinished ||
      activeTransaction.status?.isError ||
      success ||
      didCelebrate.current
    )
      return;
    setSuccess(true);
    didCelebrate.current = true;
    void confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#22c55e", "#10b981", "#34d399"],
    });
  }, [
    activeTransaction.isFinished,
    activeTransaction.status?.isError,
    success,
  ]);
  useEffect(() => {
    mode === "drain" ? streamReset() : drainReset();
  }, [drainReset, mode, streamReset]);
  useEffect(() => {
    if (isOpen) return;
    setMode("drain");
    setInput("");
    setSuccess(false);
    setShowStreams(false);
    setSelectedFontaine(null);
    didCelebrate.current = false;
    drainReset();
    streamReset();
  }, [drainReset, isOpen, streamReset]);
  if (!isOpen) return null;

  const available = availableBalance ?? 0n;
  const belowMinimum = Boolean(
    amount && amount > 0n && amount < MIN_UNLOCK_AMOUNT,
  );
  const isValid = Boolean(
    amount && amount >= MIN_UNLOCK_AMOUNT && amount <= available,
  );
  const immediateAmount = amount ? (20n * amount) / 100n : 0n;
  const communityCharge = amount ? (80n * amount) / 100n : 0n;
  const finishDate = new Date(Date.now() + 31_536_000_000).toLocaleDateString(
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  );
  const done = () => {
    setInput("");
    setSuccess(false);
    onClose();
  };
  const status = belowMinimum
    ? {
        isError: true,
        displayText: "Minimum withdrawal amount is 10 SUP",
        isLoading: false,
        isFinished: false,
      }
    : activeTransaction.status;

  return (
    <div
      role="dialog"
      aria-label="Withdraw from Reserve"
      className="modal max-w-xl bg-gradient-to-t from-green-pale via-platinum-light to-platinum p-4 sm:p-6"
    >
      <button aria-label="Close" onClick={onClose}>
        ×
      </button>
      <div className="grid w-full grid-cols-2 rounded-lg bg-white p-1">
        <button
          className={mode === "drain" ? "bg-green-sf" : ""}
          onClick={() => setMode("drain")}
        >
          DRAIN
        </button>
        <button
          className={mode === "stream" ? "bg-green-sf" : ""}
          onClick={() => setMode("stream")}
        >
          STREAM WITHDRAW
        </button>
      </div>

      {mode === "stream" && showStreams ? (
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <h2 className="mb-2 text-title3">Withdrawn Streams</h2>
            <p className="text-alto text-base">
              Below are your active withdrawn streams. These are streaming SUP
              to you over 12 months.
            </p>
          </div>
          <div className="max-h-[300px] space-y-2 overflow-y-auto rounded-lg bg-white p-6">
            {fontainesQuery.isLoading ||
            (isWaitingForIndex && fontaines.length === 0) ? (
              <div className="flex h-24 items-center justify-center text-gray-500">
                Loading streams...
              </div>
            ) : fontaines.length === 0 ? (
              <div
                key={recentTimestamp}
                className="flex h-24 items-center justify-center text-gray-500"
              >
                No withdrawn streams found
              </div>
            ) : (
              fontaines.map((fontaine) => (
                <FontaineListItem
                  key={fontaine.id}
                  fontaine={fontaine}
                  isSelected={selectedFontaine === fontaine.id}
                  onSelect={() =>
                    setSelectedFontaine(
                      selectedFontaine === fontaine.id ? null : fontaine.id,
                    )
                  }
                />
              ))
            )}
          </div>
          {selectedFontaine &&
            (() => {
              const fontaine = fontaines.find(
                (candidate) => candidate.id === selectedFontaine,
              );
              if (!fontaine) return null;
              const url = `https://app.superfluid.org/stream/base/${fontaine.id}-${fontaine.recipient}-${SUP_TOKEN_ADDRESS_BY_CHAIN[airdropChain.id]}`;
              return (
                <Link
                  className="button button-outline gap-2"
                  href={url}
                  target="_blank"
                >
                  View Stream on Superfluid Dashboard <ExternalLink size={16} />
                </Link>
              );
            })()}
          <button onClick={() => setShowStreams(false)}>Go Back</button>
        </div>
      ) : (
        <div className="space-y-6 rounded-lg bg-white p-6">
          <div className="flex items-start justify-between rounded-lg border border-platinum bg-[#F7F8FA] p-4">
            <div>
              <div className="flex gap-2">
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={input}
                  onChange={(event) =>
                    setInput(sanitizeTokenInput(event.target.value))
                  }
                />
                <button
                  onClick={() =>
                    available > 0n && setInput(formatEther(available))
                  }
                  disabled={!available}
                >
                  MAX
                </button>
              </div>
            </div>
            <div className="text-right">
              <strong>SUP</strong>
              <div>
                {availableBalance !== undefined
                  ? `${formatTokenAmount(availableBalance, 2)} SUP`
                  : "-"}
              </div>
            </div>
          </div>
          {mode === "drain" ? (
            <>
              <div className="space-y-3">
                <div className="text-green text-sm uppercase">
                  If you drain your Reserve
                </div>
                <div className="flex justify-between">
                  <span>SUP you will receive</span>
                  <span>{formatTokenAmount(immediateAmount, 4)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Community charges</span>
                  <span>{formatTokenAmount(communityCharge, 4)}</span>
                </div>
              </div>
              <p className="text-center text-green text-xs uppercase">
                If you drain your Reserve you will instantly receive 20% of your
                Reserve SUP, with the remaining 80% charged as community charges
              </p>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div className="text-green text-sm uppercase">
                  If you stream withdraw your Reserve
                </div>
                <div className="flex justify-between">
                  <span>SUP you will receive</span>
                  <span>{amount ? formatTokenAmount(amount, 4) : "0"} SUP</span>
                </div>
                {amount && amount > 0n && (
                  <div className="flex justify-between">
                    <span>You will receive the full amount on</span>
                    <span>{finishDate}</span>
                  </div>
                )}
              </div>
              <p className="text-center text-green text-xs uppercase">
                If you stream withdraw your Reserve you will receive all the
                available SUP in your Reserve in a stream over 12 months
              </p>
              {hasStreams && (
                <button
                  className="text-purple text-sm underline"
                  onClick={() => setShowStreams(true)}
                >
                  See withdrawn streams
                </button>
              )}
            </>
          )}
          {success ? (
            <button data-testid="done-button" className="w-full" onClick={done}>
              Done
            </button>
          ) : (
            <TransactionButton
              dataTestId={
                mode === "drain"
                  ? "drain-reserve-button"
                  : "stream-withdraw-button"
              }
              chain={airdropChain}
              onClick={activeTransaction.unlock}
              status={status}
              ButtonProps={{ disabled: !isValid || success }}
            >
              {mode === "drain" ? "Drain Reserve" : "Stream Withdraw"}
            </TransactionButton>
          )}
        </div>
      )}
    </div>
  );
}
