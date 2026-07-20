"use client";

import Link from "next/link";

import { useLocker } from "../../contexts/LockerContext";
import { useLockerBalance } from "../../hooks/useLockerBalance";
import { formatTokenAmount } from "../../lib/format";
import { CreateReserveSection } from "../../components/reserve/CreateReserveSection";
import { ReserveActionsDropdown } from "../../components/reserve/ReserveActionsDropdown";

function ReserveContent() {
  const { lockerAddress } = useLocker();
  const { data } = useLockerBalance({ lockerAddress });
  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-h5">My Reserve</h1>
        <ReserveActionsDropdown />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="relative flex min-h-[500px] flex-col justify-between overflow-hidden rounded-2xl bg-green-pale p-8 text-center">
          <div>
            <div className="text-green text-subtitle2 uppercase">
              MY RESERVE BALANCE
            </div>
            <div className="mt-4 text-h7">
              {formatTokenAmount(data?.totalBalance ?? 0n, 0)}{" "}
              <span className="text-title4">SUP</span>
            </div>
          </div>
          <Link className="button button-outline" href="/claim">
            Claim SUP
          </Link>
        </section>
        <section className="relative flex min-h-[500px] flex-col justify-between overflow-hidden rounded-2xl bg-[#001713] p-8 text-center text-white">
          <div>
            <div className="text-green-sf uppercase">MY PROVIDED LIQUIDITY</div>
            <div className="mt-4 text-h7">
              {formatTokenAmount(data?.liquidityBalance ?? 0n, 0)}{" "}
              <span className="text-title4">SUP</span>
            </div>
          </div>
          <Link className="button button-outline" href="/liquidity">
            {data?.liquidityBalance ? "Manage Liquidity" : "Add Liquidity"}
          </Link>
        </section>
        <section className="relative flex min-h-[500px] flex-col justify-between overflow-hidden rounded-2xl bg-[#5F6E75] p-8 text-center text-white">
          <div>
            <div className="text-green-sf uppercase">MY STAKED BALANCE</div>
            <div className="mt-4 text-h7">
              {formatTokenAmount(data?.stakedBalance ?? 0n, 0)}{" "}
              <span className="text-title4">SUP</span>
            </div>
          </div>
          <Link className="button button-outline" href="/staking">
            {data?.stakedBalance ? "Manage Staking" : "Stake"}
          </Link>
        </section>
      </div>
    </div>
  );
}

export default function ReservePage() {
  const { lockerAddress } = useLocker();
  return lockerAddress ? <ReserveContent /> : <CreateReserveSection />;
}
