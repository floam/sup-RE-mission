"use client";

import Link from "next/link";

import { CreateReserveSection } from "../../components/reserve/CreateReserveSection";
import { ReserveActionsDropdown } from "../../components/reserve/ReserveActionsDropdown";
import { useLocker } from "../../contexts/LockerContext";
import { useLockerBalance } from "../../hooks/useLockerBalance";
import { formatTokenAmount } from "../../lib/format";

function ReserveContent() {
  const { lockerAddress } = useLocker();
  const { data } = useLockerBalance({ lockerAddress });
  return (
    <main className="terminal-page">
      <p className="command-line">
        <span className="prompt">&gt;</span> reserve
      </p>
      <p><ReserveActionsDropdown /></p>
      <div className="route-lines">
        <p className="route-line">
          <strong>reserve balance</strong>
          <span>{formatTokenAmount(data?.totalBalance ?? 0n, 0)} SUP</span>
        </p>
        <p className="route-line">
          <strong>provided liquidity</strong>
          <span>
            {formatTokenAmount(data?.liquidityBalance ?? 0n, 0)} SUP ·{" "}
            <Link href="/liquidity">
              {data?.liquidityBalance ? "manage" : "add liquidity"}
            </Link>
          </span>
        </p>
        <p className="route-line">
          <strong>staked balance</strong>
          <span>
            {formatTokenAmount(data?.stakedBalance ?? 0n, 0)} SUP ·{" "}
            <Link href="/staking">
              {data?.stakedBalance ? "manage" : "stake"}
            </Link>
          </span>
        </p>
      </div>
      <p><Link href="/claim">claim SUP</Link></p>
    </main>
  );
}

export default function ReservePage() {
  const { lockerAddress } = useLocker();
  return lockerAddress ? <ReserveContent /> : <CreateReserveSection />;
}
