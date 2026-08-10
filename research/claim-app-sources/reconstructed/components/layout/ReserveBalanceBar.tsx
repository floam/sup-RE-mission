"use client";

import Link from "next/link";

import { useLocker } from "../../contexts/LockerContext";
import { useLockerBalance } from "../../hooks/useLockerBalance";
import { FlowingBalance } from "../FlowingBalance";

export function ReserveBalanceBar() {
  const { accountAddress, lockerAddress, isLockerAddressLoading } = useLocker();
  const balance = useLockerBalance({ lockerAddress });
  const data = balance.data;

  let value = "connect to view";
  if (accountAddress) {
    value = isLockerAddressLoading
      ? "loading…"
      : lockerAddress
        ? "loading…"
        : "not created";
  }

  return (
    <div className="reserve-balance-bar" aria-live="polite">
      <Link href="/reserve">reserve balance</Link>
      <span data-testid="reserve-balance">
        {lockerAddress && data?.isFullyLoaded ? (
          <>
            <FlowingBalance
              balance={data.totalBalance}
              balanceTimestamp={data.timestamp}
              flowRate={data.flowRate}
              decimalPlaces={3}
            />{" "}
            SUP
          </>
        ) : (
          value
        )}
      </span>
    </div>
  );
}
