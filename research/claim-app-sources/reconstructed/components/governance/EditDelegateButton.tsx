"use client";

import { useEffect, useState } from "react";

import { APP_CHAIN } from "../../config/chains";
import { useLocker } from "../../contexts/LockerContext";
import { useAddressProfile } from "../../hooks/useAddressProfile";
import { useClearDelegate } from "../../hooks/useDelegateTransactions";
import {
  useCurrentDelegate,
  useDelegatedAmount,
} from "../../hooks/useDelegation";
import { formatTokenAmount } from "../../lib/format";
import { TransactionButton } from "../TransactionButton";
import { DelegateAvatar } from "./DelegateAvatar";
import { DelegateStep } from "./DelegateStep";

export function EditDelegateButton() {
  const { accountAddress } = useLocker();
  const { delegate, hasExternalDelegate } = useCurrentDelegate({
    accountAddress,
  });
  const clear = useClearDelegate({ accountAddress, hasExternalDelegate });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (delegate && clear.status?.isFinished) clear.writeClearDelegate.reset();
  }, [clear.status?.isFinished, clear.writeClearDelegate, delegate]);

  if (!accountAddress) return null;
  return (
    <>
      <button
        data-testid="edit-delegate-button"
        aria-label="Edit delegate"
        onClick={() => setOpen(true)}
      >
        ✎
      </button>
      {open && (
        <div
          role="dialog"
          data-testid="edit-delegate-dialog"
          className="modal max-w-screen-md bg-platinum md:h-[800px]"
        >
          <button aria-label="Close" onClick={() => setOpen(false)}>
            ×
          </button>
          <h2 className="sr-only">Edit delegate</h2>
          <p className="sr-only">Edit your SUP delegation</p>
          <div className="flex gap-4 max-md:flex-col">
            {delegate && (
              <CurrentDelegateCard
                delegate={delegate}
                hasExternalDelegate={hasExternalDelegate}
                clearDelegate={clear.clearDelegate}
                status={clear.status}
              />
            )}
            <DelegateStep stepper={null} className="flex-1 max-md:h-[70vh]" />
          </div>
        </div>
      )}
    </>
  );
}

function CurrentDelegateCard({
  delegate,
  hasExternalDelegate,
  clearDelegate,
  status,
}: {
  delegate: NonNullable<ReturnType<typeof useCurrentDelegate>["delegate"]>;
  hasExternalDelegate: boolean;
  clearDelegate(): void;
  status: ReturnType<typeof useClearDelegate>["status"];
}) {
  const profile = useAddressProfile(delegate.address);
  const { delegatedAmount, isDelegatedAmountLoaded } =
    useDelegatedAmount(delegate);
  return (
    <div className="flex max-w-64 flex-col max-md:max-w-full">
      <div className="rounded-t-lg bg-violet-light px-5 py-4 pb-6">
        Your current delegate
      </div>
      <div className="-mt-2 flex gap-2 rounded-lg bg-violet-dark px-5 py-4 text-white">
        {profile && (
          <DelegateAvatar delegate={delegate} className="h-6 w-6 shadow-md" />
        )}
        <div>
          <div data-testid="your-delegate-name" className="text-subtitle3">
            {delegate.name}
          </div>
          <div
            data-testid="your-delegate-address"
            className="pt-1 pb-2 text-caption4"
          >
            {profile?.addressTruncated}
          </div>
          {isDelegatedAmountLoaded && (
            <span
              data-testid="your-delegates-delegated-amount"
              className="badge badge-dark"
            >
              {formatTokenAmount(delegatedAmount)} SUP delegated
            </span>
          )}
          <div
            data-testid="your-delegate-description"
            className="pt-4 text-caption2"
          >
            {delegate.description}
          </div>
        </div>
      </div>
      {hasExternalDelegate && (
        <TransactionButton
          dataTestId="undelegate-button"
          chain={APP_CHAIN}
          ButtonProps={{ className: "mt-3" }}
          onClick={clearDelegate}
          status={status}
        >
          Undelegate
        </TransactionButton>
      )}
    </div>
  );
}
