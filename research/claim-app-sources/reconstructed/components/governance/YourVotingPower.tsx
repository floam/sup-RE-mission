"use client";

import { useLocker } from "../../contexts/LockerContext";
import { useLockerBalance } from "../../hooks/useLockerBalance";
import { formatTokenAmount } from "../../lib/format";

export function YourVotingPower() {
  const { lockerAddress, isLockerAddressLoading } = useLocker();
  const { data } = useLockerBalance({ lockerAddress });
  if (isLockerAddressLoading) return <span className="invisible">N/A</span>;
  if (!lockerAddress) return "0";
  return data ? (
    formatTokenAmount(data.totalBalance ?? 0n)
  ) : (
    <span className="invisible">N/A</span>
  );
}
