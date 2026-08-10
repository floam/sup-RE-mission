"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatEther } from "viem";

import { APP_CHAIN } from "../../config/chains";
import {
  MIN_UNLOCK_AMOUNT,
  SUP_TOKEN_ADDRESS_BY_CHAIN,
} from "../../contracts/app-contracts";
import { useLocker } from "../../contexts/LockerContext";
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
  const { accountAddress, lockerAddress } = useLocker();
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
      success
    )
      return;
    setSuccess(true);
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
    { month: "short", day: "numeric", year: "numeric" },
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
    <div className="wallet-dialog-overlay">
      <section
        role="dialog"
        aria-label="Withdraw from Reserve"
        className="wallet-dialog"
      >
        <p className="command-line">
          <span className="prompt">&gt;</span> withdraw from Reserve{" "}
          <button type="button" aria-label="Close" onClick={onClose}>
            [ close ]
          </button>
        </p>
        <p>
          <button
            type="button"
            className={mode === "drain" ? "positive" : undefined}
            onClick={() => setMode("drain")}
          >
            [ drain ]
          </button>{" "}
          <button
            type="button"
            className={mode === "stream" ? "positive" : undefined}
            onClick={() => setMode("stream")}
          >
            [ stream withdraw ]
          </button>
        </p>

        {mode === "stream" && showStreams ? (
          <section aria-label="Withdrawn streams">
            <p><strong>active withdrawn streams</strong></p>
            {fontainesQuery.isLoading ||
            (isWaitingForIndex && fontaines.length === 0) ? (
              <p className="dim">loading streams…</p>
            ) : fontaines.length === 0 ? (
              <p className="dim">no withdrawn streams</p>
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
            {selectedFontaine &&
              (() => {
                const fontaine = fontaines.find(
                  (candidate) => candidate.id === selectedFontaine,
                );
                if (!fontaine) return null;
                const url = `https://app.superfluid.org/stream/base/${fontaine.id}-${fontaine.recipient}-${SUP_TOKEN_ADDRESS_BY_CHAIN[APP_CHAIN.id]}`;
                return (
                  <p>
                    <Link href={url} target="_blank">
                      [ view stream on Superfluid ↗ ]
                    </Link>
                  </p>
                );
              })()}
            <p>
              <button type="button" onClick={() => setShowStreams(false)}>
                [ back ]
              </button>
            </p>
          </section>
        ) : (
          <section aria-label={`${mode} withdrawal`}>
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
              available {formatTokenAmount(available, 2)} SUP ·{" "}
              <button
                type="button"
                onClick={() =>
                  available > 0n && setInput(formatEther(available))
                }
                disabled={!available}
              >
                max
              </button>
            </p>

            {mode === "drain" ? (
              <div className="route-lines">
                <p className="route-line">
                  <strong>receive now</strong>
                  <span>{formatTokenAmount(immediateAmount, 4)} SUP</span>
                </p>
                <p className="route-line">
                  <strong>community charge</strong>
                  <span>{formatTokenAmount(communityCharge, 4)} SUP</span>
                </p>
                <p className="dim">
                  drain returns 20% immediately and charges the remaining 80%
                </p>
              </div>
            ) : (
              <div className="route-lines">
                <p className="route-line">
                  <strong>stream total</strong>
                  <span>{amount ? formatTokenAmount(amount, 4) : "0"} SUP</span>
                </p>
                <p className="route-line">
                  <strong>completion</strong>
                  <span>{amount && amount > 0n ? finishDate : "—"}</span>
                </p>
                <p className="dim">
                  stream withdraw sends the full amount over 12 months
                </p>
                {hasStreams && (
                  <p>
                    <button type="button" onClick={() => setShowStreams(true)}>
                      [ view withdrawn streams ]
                    </button>
                  </p>
                )}
              </div>
            )}

            {success ? (
              <p>
                <span className="positive">withdrawal confirmed</span>{" "}
                <button data-testid="done-button" type="button" onClick={done}>
                  [ done ]
                </button>
              </p>
            ) : (
              <TransactionButton
                dataTestId={
                  mode === "drain"
                    ? "drain-reserve-button"
                    : "stream-withdraw-button"
                }
                chain={APP_CHAIN}
                onClick={activeTransaction.unlock}
                status={status}
                ButtonProps={{ disabled: !isValid || success }}
              >
                {mode === "drain"
                  ? "[ drain Reserve ]"
                  : "[ stream withdraw ]"}
              </TransactionButton>
            )}
          </section>
        )}
      </section>
    </div>
  );
}
