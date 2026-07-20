"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useExpectedChains } from "../../contexts/ExpectedChainContext";
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
import { DelegateAvatar } from "./DelegateAvatar";

export interface DelegateStepper {
  next(): void;
}

function DelegateListEntry({
  delegate,
  onClick,
  isSelected,
  isLocked,
  className = "",
}: {
  delegate: DelegateProfile;
  onClick(): void;
  isSelected: boolean;
  isLocked: boolean;
  className?: string;
}) {
  const { delegatedAmount, isDelegatedAmountLoaded } =
    useDelegatedAmount(delegate);
  return (
    <button
      type="button"
      data-testid={`${delegate.address}-delegate-list-entry`}
      className={`flex w-full cursor-pointer gap-2 px-5 py-[18px] text-left transition-colors ${
        isSelected || isLocked
          ? "rounded-[20px] bg-[#8330FD] text-white"
          : "hover:bg-platinum"
      } ${className}`}
      onClick={onClick}
    >
      <DelegateAvatar delegate={delegate} className="h-8 w-8 shadow-md" />
      <span className="flex flex-1 flex-col justify-between gap-3">
        <span className="flex flex-row justify-between">
          <span className="flex flex-col">
            <span data-testid="delegate-name" className="text-subtitle3">
              {delegate.name}
            </span>
            <span data-testid="delegate-address" className="text-caption4">
              {delegate.address.slice(0, 6)}...{delegate.address.slice(-4)}
            </span>
          </span>
          {isDelegatedAmountLoaded && (
            <span
              data-testid="delegate-delegated-amount"
              className="badge badge-dark"
            >
              {formatTokenAmount(delegatedAmount)} SUP delegated
            </span>
          )}
        </span>
        <span data-testid="delegate-description" className="text-caption2">
          {delegate.description}
        </span>
      </span>
    </button>
  );
}

function DelegateSkeleton() {
  return <div className="m-5 h-28 animate-pulse rounded-md bg-platinum" />;
}

export function DelegateStep({
  stepper,
  className = "",
}: {
  stepper?: DelegateStepper | null;
  className?: string;
}) {
  const isOnboarding = Boolean(stepper);
  const { governanceChain } = useExpectedChains();
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
    <div
      className={`flex h-full flex-col items-center justify-between gap-4 ${className}`}
    >
      <div className="flex h-full w-full flex-col overflow-hidden rounded-xl bg-white">
        <div className="flex items-center justify-between border-b px-5 py-[18px]">
          <h3 className="font-medium">List of delegates</h3>
        </div>
        <div className="min-h-[360px] flex-1 overflow-y-auto">
          {visibleDelegates.map((delegate, index) => (
            <DelegateListEntry
              key={delegate.address}
              delegate={delegate}
              onClick={() => setSelectedDelegate(delegate)}
              isSelected={selectedDelegate === delegate}
              isLocked={currentDelegate === delegate}
              className={index === 0 ? "" : "border-t"}
            />
          ))}
          {readDelegates.isLoading &&
            Array.from({ length: 5 }, (_, index) => (
              <DelegateSkeleton key={index} />
            ))}
        </div>
        <Link
          className="button button-dark rounded-t-none"
          href="https://forum.superfluid.org/t/about-the-delegate-platform-category/23"
          target="_blank"
        >
          Become Delegate ↗
        </Link>
      </div>
      {complete ? (
        <button data-testid="continue-button" onClick={() => stepper?.next()}>
          Success! Continue
        </button>
      ) : mustUndelegateFirst ? (
        <TransactionButton
          dataTestId="undelegate-button"
          chain={governanceChain}
          onClick={clear.clearDelegate}
          status={clear.status}
          ButtonProps={{ disabled: true }}
        >
          Undelegate first to change
        </TransactionButton>
      ) : (
        <TransactionButton
          dataTestId="delegate-button"
          chain={governanceChain}
          onClick={submit}
          status={selectedStatus}
          ButtonProps={{ disabled }}
        >
          Delegate
        </TransactionButton>
      )}
    </div>
  );
}
