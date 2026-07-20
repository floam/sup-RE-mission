"use client";

import { useEffect } from "react";

import { useExpectedChains } from "../../contexts/ExpectedChainContext";
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

/** Server-action IDs observed by the client:
 * getStakingStats `00a6446d221d62d46ca41e7294731c14ab30fc9053`
 * getLiquidityRewardsStats `0099a827feb87232328ca49a8aaec8daa5598e5c0c`. */
export function CreateReserveSection({
  stakingStats,
  liquidityStats,
}: {
  stakingStats?: RewardStats;
  liquidityStats?: RewardStats;
}) {
  const { isConnected } = useWalletAccount();
  const { accountAddress } = useLocker();
  const { airdropChain } = useExpectedChains();
  const transaction = useCreateLocker(accountAddress);
  const [isCreated] = (transaction.readGetUserLocker.data as
    | readonly [boolean, string]
    | undefined) ?? [false];
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
    <section
      className="relative min-h-[600px] overflow-hidden text-center"
      style={{
        background:
          "radial-gradient(circle at center bottom, #8AE5C3, #0A6643)",
      }}
    >
      <div className="relative z-10 space-y-4 py-16">
        <h1 className="font-medium text-green-superdark text-h2">
          Earn more SUP
        </h1>
        <p className="text-alto-dark text-title4 uppercase tracking-wide">
          DEPOSIT SUP IN A RESERVE TO EARN STAKING AND LP REWARDS
        </p>
        <div className="mx-auto max-w-2xl rounded-3xl bg-black/70 px-8 py-12 text-white">
          <p className="text-h6">up to {apr} APR</p>
          <p className="text-green-sf uppercase">IN STAKING AND LP REWARDS</p>
        </div>
        <div className="mx-auto max-w-md pt-4">
          {isConnected ? (
            <TransactionButton
              chain={airdropChain}
              onClick={transaction.createLocker}
              status={transaction.status}
              dataTestId="create-reserve-button"
              ButtonProps={{ disabled: Boolean(isCreated || finished) }}
            >
              {finished ? "Reserve Created!" : "Create Your Reserve"}
            </TransactionButton>
          ) : (
            <SignUpToParticipateButton buttonText="Connect Wallet to Get Started" />
          )}
        </div>
      </div>
    </section>
  );
}
