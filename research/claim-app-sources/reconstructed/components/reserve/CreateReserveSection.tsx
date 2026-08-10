"use client";

import { useEffect } from "react";

import { APP_CHAIN } from "../../config/chains";
import { useLocker } from "../../contexts/LockerContext";
import { useCreateLocker } from "../../hooks/useCreateLocker";
import { useWalletAccount } from "../../hooks/useWalletAccount";
import { recordRecentTransaction } from "../../hooks/useRecentTransactions";
import { SignUpToParticipateButton } from "../SignUpToParticipateButton";
import { TransactionButton } from "../TransactionButton";

export interface RewardStats {
  apr: number;
  bonusApr: number;
}

export function CreateReserveSection({
  stakingStats,
  liquidityStats,
}: {
  stakingStats?: RewardStats;
  liquidityStats?: RewardStats;
}) {
  const { isConnected } = useWalletAccount();
  const { accountAddress } = useLocker();
  const transaction = useCreateLocker(accountAddress);
  const [isCreated] = (transaction.readGetUserLocker.data as
    readonly [boolean, string] | undefined) ?? [false];
  const totalApr = Math.max(
    (stakingStats?.apr ?? 0) + (stakingStats?.bonusApr ?? 0),
    (liquidityStats?.apr ?? 0) + (liquidityStats?.bonusApr ?? 0),
  );
  const apr = totalApr === 0 ? "N/A" : `${Math.ceil(totalApr)}%`;
  const finished = transaction.status?.isFinished ?? false;
  const hash = transaction.waitForTransactionCreateLocker.data?.transactionHash;

  useEffect(() => {
    if (finished && hash)
      recordRecentTransaction({
        type: "reserve-created",
        hash,
        timestamp: Date.now(),
      });
  }, [finished, hash]);

  return (
    <main className="terminal-page">
      <p className="command-line">
        <span className="prompt">&gt;</span> reserve
      </p>
      <p>Create a Reserve before staking, providing liquidity, or claiming SUP.</p>
      <div className="route-lines">
        <p className="route-line">
          <strong>reward APR</strong>
          <span>up to {apr}</span>
        </p>
        <p className="route-line">
          <strong>custody</strong>
          <span>wallet-controlled Reserve contract</span>
        </p>
      </div>
      {isConnected ? (
        <TransactionButton
          chain={APP_CHAIN}
          onClick={transaction.createLocker}
          status={transaction.status}
          dataTestId="create-reserve-button"
          ButtonProps={{ disabled: Boolean(isCreated || finished) }}
        >
          {finished ? "reserve created" : "[ create Reserve ]"}
        </TransactionButton>
      ) : (
        <SignUpToParticipateButton buttonText="[ connect wallet ]" />
      )}
    </main>
  );
}
