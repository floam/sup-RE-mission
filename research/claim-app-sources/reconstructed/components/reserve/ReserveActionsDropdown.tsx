"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  Copy,
  ExternalLink,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useLocker } from "../../contexts/LockerContext";
import { truncateAddress } from "../../lib/format";
import { DepositToReserveDialog } from "./DepositToReserveDialog";
import { WithdrawFromReserveDialog } from "./WithdrawFromReserveDialog";

export function ReserveActionsDropdown({
  className,
  userEnsName,
  hasExistingSubdomain = false,
}: {
  className?: string;
  userEnsName?: string;
  hasExistingSubdomain?: boolean;
}) {
  const { lockerAddress } = useLocker();
  const [open, setOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const name = userEnsName ? userEnsName.split(".")[0] : null;
  const copy = async () => {
    if (!lockerAddress) return;
    await navigator.clipboard.writeText(lockerAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1_000);
  };
  return (
    <>
      <div className={`relative ${className ?? ""}`}>
        <button
          className="items-center gap-1 bg-[#E9E9E9]"
          onClick={() => setOpen(!open)}
        >
          Actions <ChevronDown size={20} className={open ? "rotate-180" : ""} />
        </button>
        {open && (
          <div className="absolute right-0 z-10 w-60 rounded-md bg-white p-1 shadow-lg">
            <button
              className="flex w-full gap-3"
              onClick={() => {
                setOpen(false);
                setDepositOpen(true);
              }}
            >
              <ArrowDownToLine size={16} />
              Deposit SUP in Reserve
            </button>
            <hr />
            <button
              className="flex w-full gap-3"
              onClick={() => {
                setOpen(false);
                setWithdrawOpen(true);
              }}
            >
              <ArrowUpFromLine size={16} />
              Withdraw from Reserve
            </button>
            <hr />
            <Link
              className="flex gap-3"
              href={`https://app.superfluid.org/?view=${lockerAddress}`}
              target="_blank"
            >
              <ExternalLink size={16} />
              View on Superfluid Dashboard
            </Link>
            <hr />
            <Link className="flex gap-3" href="/reserve-names">
              <Tag size={16} />
              <span>
                {hasExistingSubdomain
                  ? "See Your Reserve Name"
                  : "Get Reserve Name"}
                <small>
                  {hasExistingSubdomain && name ? name : "Not claimed"}
                </small>
              </span>
            </Link>
            <hr />
            <button className="flex w-full gap-3" onClick={copy}>
              <Copy size={16} />
              <span>
                {copied ? "Copied!" : "Copy Reserve Address"}
                <small>
                  {lockerAddress ? truncateAddress(lockerAddress) : ""}
                </small>
              </span>
            </button>
          </div>
        )}
      </div>
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
