"use client";

import Link from "next/link";

import { useLocker } from "../../contexts/LockerContext";
import { useLockerBalance } from "../../hooks/useLockerBalance";
import type { Address } from "../../types/program-app";
import { FlowingBalance } from "../FlowingBalance";

function LiveReserveBalance({ lockerAddress }: { lockerAddress: Address }) {
  const balance = useLockerBalance({ lockerAddress });
  const data = balance.data;

  // The net-flow read is useful for animation, but it must not block the balance.
  // Show the balance from the faster reserve reads and use a static value until
  // the independent flow read is available.
  if (!data?.hasTotalBalanceLoaded) return <>loading…</>;

  return (
    <>
      <FlowingBalance
        balance={data.totalBalance}
        balanceTimestamp={data.timestamp}
        flowRate={data.flowRate}
        decimalPlaces={2}
      />{" "}
      SUP
    </>
  );
}

export function ReserveBalanceBar() {
  const { accountAddress, lockerAddress, isLockerAddressLoading } = useLocker();

  let value = "connect to view";
  if (accountAddress) {
    value = isLockerAddressLoading
      ? "loading…"
      : lockerAddress
        ? "loading…"
        : "not created";
  }

  return (
    <div className="reserve-balance-bar">
      {accountAddress ? (
        <Link href="/reserve">reserve balance</Link>
      ) : (
        <span>reserve balance</span>
      )}
      <span data-testid="reserve-balance">
        {lockerAddress ? (
          <LiveReserveBalance lockerAddress={lockerAddress} />
        ) : (
          value
        )}
      </span>
    </div>
  );
}
