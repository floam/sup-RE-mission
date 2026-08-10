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
        [ edit ]
      </button>
      {open && (
        <section role="dialog" data-testid="edit-delegate-dialog">
          <p className="command-line">
            <span className="prompt">&gt;</span> edit delegate{" "}
            <button aria-label="Close" onClick={() => setOpen(false)}>
              [ close ]
            </button>
          </p>
          {delegate && (
            <CurrentDelegateLines
              delegate={delegate}
              hasExternalDelegate={hasExternalDelegate}
              clearDelegate={clear.clearDelegate}
              status={clear.status}
            />
          )}
          <DelegateStep stepper={null} />
        </section>
      )}
    </>
  );
}

function CurrentDelegateLines({
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
    <div className="route-lines">
      <p className="route-line">
        <strong>current delegate</strong>
        <span data-testid="your-delegate-name">{delegate.name}</span>
      </p>
      <p className="route-line">
        <strong>address</strong>
        <span data-testid="your-delegate-address">
          {profile?.addressTruncated ?? delegate.address}
        </span>
      </p>
      {isDelegatedAmountLoaded && (
        <p className="route-line">
          <strong>delegated</strong>
          <span data-testid="your-delegates-delegated-amount">
            {formatTokenAmount(delegatedAmount)} SUP
          </span>
        </p>
      )}
      <p className="route-line">
        <strong>description</strong>
        <span data-testid="your-delegate-description">
          {delegate.description}
        </span>
      </p>
      {hasExternalDelegate && (
        <TransactionButton
          dataTestId="undelegate-button"
          chain={APP_CHAIN}
          onClick={clearDelegate}
          status={status}
        >
          [ undelegate ]
        </TransactionButton>
      )}
    </div>
  );
}
