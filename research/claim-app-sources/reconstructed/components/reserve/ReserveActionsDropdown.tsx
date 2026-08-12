"use client";

import Link from "next/link";
import { useState } from "react";

import { useLocker } from "../../contexts/LockerContext";
import { truncateAddress } from "../../lib/format";
import { DepositToReserveDialog } from "./DepositToReserveDialog";
import { WithdrawFromReserveDialog } from "./WithdrawFromReserveDialog";

export function ReserveActionsDropdown({
  userEnsName,
  hasExistingSubdomain = false,
}: {
  className?: string;
  userEnsName?: string;
  hasExistingSubdomain?: boolean;
}) {
  const { lockerAddress } = useLocker();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const name = userEnsName ? userEnsName.split(".")[0] : null;

  const copy = async () => {
    if (!lockerAddress) return;
    await navigator.clipboard.writeText(lockerAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_000);
  };

  return (
    <>
      <span aria-label="Reserve actions">
        <strong>[ reserve actions ]</strong>{" "}
        <button type="button" onClick={() => setDepositOpen(true)}>
          [ deposit SUP ]
        </button>{" "}
        <button type="button" onClick={() => setWithdrawOpen(true)}>
          [ withdraw ]
        </button>{" "}
        <Link
          href={`https://app.superfluid.org/?view=${lockerAddress}`}
          target="_blank"
        >
          [ dashboard ↗ ]
        </Link>{" "}
        <Link href="/reserve-names">
          [ {hasExistingSubdomain && name ? name : "reserve name"} ]
        </Link>{" "}
        <button type="button" onClick={copy}>
          [ {copied ? "copied" : `copy ${lockerAddress ? truncateAddress(lockerAddress) : "address"}`} ]
        </button>
      </span>
      <DepositToReserveDialog
        isOpen={depositOpen}
        onClose={() => setDepositOpen(false)}
      />
      <WithdrawFromReserveDialog
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
      />
    </>
  );
}
