"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { APP_CHAIN } from "../../config/chains";
import { useLocker } from "../../contexts/LockerContext";
import {
  useClearDelegate,
  useSetDelegate,
} from "../../hooks/useDelegateTransactions";
import {
  useCurrentDelegate,
  useDelegatedAmount,
  useDelegates,
} from "../../hooks/useDelegation";
import { formatTokenAmount } from "../../lib/format";
import type { DelegateProfile } from "../../types/governance";
import { TransactionButton } from "../TransactionButton";

export interface DelegateStepper {
  next(): void;
}

function DelegateListEntry({
  delegate,
  onClick,
  isSelected,
  isLocked,
}: {
  delegate: DelegateProfile;
  onClick(): void;
  isSelected: boolean;
  isLocked: boolean;
}) {
  const { delegatedAmount, isDelegatedAmountLoaded } =
    useDelegatedAmount(delegate);
  return (
    <p>
      <button
        type="button"
        data-testid={`${delegate.address}-delegate-list-entry`}
        className={isSelected ? "positive" : undefined}
        onClick={onClick}
      >
        {isSelected ? "[✓]" : isLocked ? "[·]" : "[ ]"}{" "}
        <span data-testid="delegate-name">{delegate.name}</span>{" "}
        <span data-testid="delegate-address" className="dim">
          {delegate.address.slice(0, 6)}…{delegate.address.slice(-4)}
        </span>
        {isDelegatedAmountLoaded && (
          <span data-testid="delegate-delegated-amount">
            {" "}· {formatTokenAmount(delegatedAmount)} SUP
          </span>
        )}
      </button>
      <span data-testid="delegate-description" className="dim">
        {" "}· {delegate.description}
      </span>
    </p>
  );
}

export function DelegateStep({
  stepper,
}: {
  stepper?: DelegateStepper | null;
  className?: string;
}) {
  const isOnboarding = Boolean(stepper);
  const { accountAddress } = useLocker();
  const { delegates, readDelegates } = useDelegates();
  const { delegateAddress, hasExternalDelegate } = useCurrentDelegate({
    accountAddress,
  });
  const { currentDelegate, visibleDelegates } = useMemo(() => {
    const current = delegateAddress
      ? delegates.find(
          (delegate) =>
            delegate.address.toLowerCase() === delegateAddress.toLowerCase(),
        )
      : undefined;
    return {
      currentDelegate: current,
      visibleDelegates: isOnboarding
        ? delegates
        : delegates.filter(
            (delegate) =>
              delegate.address.toLowerCase() !== delegateAddress?.toLowerCase(),
          ),
    };
  }, [delegateAddress, delegates, isOnboarding]);
  const [selectedDelegate, setSelectedDelegate] = useState<DelegateProfile>();
  const clear = useClearDelegate({ accountAddress, hasExternalDelegate });
  const set = useSetDelegate({
    accountAddress,
    delegateAddress: selectedDelegate?.address,
    hasExternalDelegate,
  });
  const [selectedSelf, setSelectedSelf] = useState(false);

  useEffect(() => {
    if (!selectedDelegate) return;
    if (clear.status?.isFinished) clear.writeClearDelegate.reset();
    if (set.status?.isFinished) set.writeSetDelegate.reset();
  }, [
    clear.status?.isFinished,
    clear.writeClearDelegate,
    selectedDelegate,
    set.status?.isFinished,
    set.writeSetDelegate,
  ]);

  const isSelfSelection = selectedDelegate?.address === accountAddress;
  const selectedStatus = isSelfSelection ? clear.status : set.status;
  const submit = useCallback(() => {
    if (isSelfSelection) {
      if (hasExternalDelegate) clear.clearDelegate();
      setSelectedSelf(true);
    } else {
      set.setDelegate();
      setSelectedSelf(false);
    }
  }, [clear, hasExternalDelegate, isSelfSelection, set]);
  const complete = Boolean(
    isOnboarding &&
      (delegateAddress || selectedStatus?.isFinished || selectedSelf),
  );

  useEffect(() => {
    if (complete) stepper?.next();
  }, [complete, stepper]);

  const disabled =
    !selectedDelegate || (hasExternalDelegate && !isSelfSelection);
  const mustUndelegateFirst = Boolean(
    disabled &&
      hasExternalDelegate &&
      selectedDelegate &&
      selectedDelegate !== currentDelegate,
  );

  return (
    <section aria-label="Delegates">
      <p><strong>delegates</strong></p>
      {visibleDelegates.map((delegate) => (
        <DelegateListEntry
          key={delegate.address}
          delegate={delegate}
          onClick={() => setSelectedDelegate(delegate)}
          isSelected={selectedDelegate === delegate}
          isLocked={currentDelegate === delegate}
        />
      ))}
      {readDelegates.isLoading && <p className="dim">loading delegates…</p>}
      <p>
        <Link
          href="https://forum.superfluid.org/t/about-the-delegate-platform-category/23"
          target="_blank"
        >
          [ become a delegate ↗ ]
        </Link>
      </p>
      {complete ? (
        <button data-testid="continue-button" onClick={() => stepper?.next()}>
          [ continue ]
        </button>
      ) : mustUndelegateFirst ? (
        <TransactionButton
          dataTestId="undelegate-button"
          chain={APP_CHAIN}
          onClick={clear.clearDelegate}
          status={clear.status}
          ButtonProps={{ disabled: true }}
        >
          undelegate first to change
        </TransactionButton>
      ) : (
        <TransactionButton
          dataTestId="delegate-button"
          chain={APP_CHAIN}
          onClick={submit}
          status={selectedStatus}
          ButtonProps={{ disabled }}
        >
          [ delegate ]
        </TransactionButton>
      )}
    </section>
  );
}
