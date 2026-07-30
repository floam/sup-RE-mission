"use client";

import { useQuery } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { useEffect, useState } from "react";
import { formatEther } from "viem";

import { FlowingBalance } from "../../components/FlowingBalance";
import { GenesisNftCard } from "../../components/staking/GenesisNftCard";
import { TransactionButton } from "../../components/TransactionButton";
import { APP_CHAIN } from "../../config/chains";
import { useLocker } from "../../contexts/LockerContext";
import { useAccumulatedStakingRewards } from "../../hooks/useAccumulatedStakingRewards";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useLockerBalance } from "../../hooks/useLockerBalance";
import {
  useLockerStake,
  useLockerUnstake,
} from "../../hooks/useStakingTransactions";
import {
  formatTokenAmount,
  parseTokenAmount,
  sanitizeTokenInput,
} from "../../lib/format";
import { getStakingStats } from "../../server-actions/stats";
import {
  deserializeStakingStats,
  type StakingStats,
} from "../../types/staking";

type StakingTab = "stake" | "unstake";

function parseInput(value: string) {
  try {
    return value && value !== "." ? parseTokenAmount(value) : undefined;
  } catch {
    return undefined;
  }
}

function AmountInputField({
  value,
  onChange,
  onMaxClick,
  maxBalance,
  actionType,
}: {
  value: string;
  onChange(value: string): void;
  onMaxClick(): void;
  maxBalance: bigint;
  actionType: "Stake" | "Unstake";
}) {
  return (
    <div>
      <div className="mb-1 text-sm">Amount to {actionType}</div>
      <div className="relative">
        <input
          inputMode="decimal"
          pattern="[0-9]*[.,]?[0-9]*"
          placeholder="0.00"
          value={value}
          onChange={(event) => onChange(sanitizeTokenInput(event.target.value))}
          className="h-14 w-full rounded-lg border px-4 pr-20"
        />
        <button
          className="absolute top-4 right-3 rounded-full bg-violet-light px-2 text-xs"
          onClick={onMaxClick}
          disabled={maxBalance === 0n}
        >
          MAX
        </button>
      </div>
    </div>
  );
}

function StakingStatsPanel({ stats }: { stats?: StakingStats }) {
  const totalStaked = stats ? formatTokenAmount(stats.totalStaked) : "N/A";
  const apr = stats ? Number(stats.apr) : Number.NaN;
  const bonusApr = stats ? Number(stats.bonusApr) : Number.NaN;
  return (
    <div className="relative grid h-[303px] grid-cols-2 overflow-hidden rounded-lg bg-green-superdark text-center text-white">
      <div className="flex flex-col items-center justify-center">
        <strong className="text-title1">{totalStaked}</strong>
        <span className="text-green-sf uppercase">Total SUP Staked</span>
      </div>
      <div className="flex flex-col items-center justify-center">
        <strong className="text-title1">
          {stats ? (
            <FlowingBalance
              balance={stats.totalDistributed}
              balanceTimestamp={stats.totalDistributedTimestamp}
              flowRate={stats.totalDistributedFlowRate}
              decimalPlaces={2}
            />
          ) : (
            "N/A"
          )}
        </strong>
        <span className="text-green-sf uppercase">Total SUP Distributed</span>
      </div>
      <div className="flex flex-col items-center justify-center">
        <strong className="text-title1">
          {stats
            ? `${stats.withdrawalPeriodDays} day${stats.withdrawalPeriodDays === 1 ? "" : "s"}`
            : "N/A"}
        </strong>
        <span className="text-green-sf uppercase">Cooldown Period</span>
      </div>
      <div className="flex flex-col items-center justify-center">
        <strong className="text-title1">
          {Number.isNaN(apr)
            ? "N/A"
            : `${apr === 0 ? "0.00" : apr.toFixed(2)}%${Number.isNaN(bonusApr) || bonusApr === 0 ? "" : ` + ${bonusApr.toFixed(2)}%`}`}
        </strong>
        <span className="text-green-sf uppercase">APR</span>
      </div>
    </div>
  );
}

export default function StakingPage() {
  const { data: stats } = useQuery({
    queryKey: ["stakingStats"],
    queryFn: getStakingStats,
    select: deserializeStakingStats,
  });
  const [tab, setTab] = useState<StakingTab>("stake");
  const [stakeInput, setStakeInput] = useState("");
  const [unstakeInput, setUnstakeInput] = useState("");
  const [stakeSucceeded, setStakeSucceeded] = useState(false);
  const [unstakeSucceeded, setUnstakeSucceeded] = useState(false);
  const { accountAddress, lockerAddress, isLockerCreated } = useLocker();
  const lockerBalance = useLockerBalance({ lockerAddress });
  const rewards = useAccumulatedStakingRewards({
    lockerAddress,
    distributionPool: stats?.taxDistributionPool,
  });
  const debouncedStakeInput = useDebouncedValue(stakeInput, 500);
  const debouncedUnstakeInput = useDebouncedValue(unstakeInput, 500);
  const stakeAmount = parseInput(debouncedStakeInput);
  const unstakeAmount = parseInput(debouncedUnstakeInput);
  const stake = useLockerStake({
    accountAddress,
    lockerAddress,
    amount: stakeAmount,
    distributionPool: stats?.taxDistributionPool,
  });
  const unstake = useLockerUnstake({
    accountAddress,
    lockerAddress,
    amount: unstakeAmount,
    distributionPool: stats?.taxDistributionPool,
  });
  const availableBalance = lockerBalance.data?.availableBalance ?? 0n;
  const stakedBalance = lockerBalance.data?.stakedBalance ?? 0n;

  useEffect(() => {
    if (!stake.status?.isFinished || stake.status.isError || stakeSucceeded)
      return;
    setStakeInput("");
    setStakeSucceeded(true);
    window.setTimeout(
      () =>
        void confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ["#22c55e", "#10b981", "#34d399"],
        }),
      0,
    );
    window.setTimeout(
      () =>
        void confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: ["#22c55e", "#10b981", "#34d399"],
        }),
      200,
    );
    window.setTimeout(
      () =>
        void confetti({
          particleCount: 70,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#22c55e", "#10b981", "#34d399", "#86ee1e"],
        }),
      400,
    );
    window.setTimeout(() => {
      stake.reset();
      setStakeSucceeded(false);
    }, 3_000);
  }, [
    stake.reset,
    stake.status?.isError,
    stake.status?.isFinished,
    stakeSucceeded,
  ]);
  useEffect(() => {
    if (
      !unstake.status?.isFinished ||
      unstake.status.isError ||
      unstakeSucceeded
    )
      return;
    setUnstakeInput("");
    setUnstakeSucceeded(true);
    window.setTimeout(() => {
      unstake.reset();
      setUnstakeSucceeded(false);
    }, 3_000);
  }, [
    unstake.reset,
    unstake.status?.isError,
    unstake.status?.isFinished,
    unstakeSucceeded,
  ]);

  const canStake = Boolean(
    stakeAmount && stakeAmount > 0n && stakeAmount <= availableBalance,
  );
  const canUnstake = Boolean(
    unstakeAmount &&
    unstakeAmount > 0n &&
    unstakeAmount <= stakedBalance &&
    unstake.canUnstake,
  );
  const cooldownActive =
    stakedBalance > 0n && unstake.stakingUnlocksAt > Date.now() / 1_000;
  const cooldownDays = cooldownActive
    ? Math.ceil((unstake.stakingUnlocksAt - Date.now() / 1_000) / 86_400)
    : 0;
  const unstakeLabel = cooldownActive
    ? `Cooldown (${cooldownDays} days left)`
    : "Unstake";

  return (
    <div className="space-y-6">
      <section className="relative rounded-lg bg-green-superdark p-8 text-white">
        <p className="text-alto uppercase">STAKE SUP</p>
        <h1 className="text-green-sf text-h1">Stake, Earn, Repeat</h1>
        <p className="uppercase">
          EARN ADDITIONAL REWARDS BY REGULARLY STAKING YOUR SUP
        </p>
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_587px]">
        <div className="flex flex-col gap-6">
          <StakingStatsPanel stats={stats} />
          <GenesisNftCard />
        </div>
        <div className="h-fit overflow-hidden rounded-lg">
          <div className="relative h-[435px] bg-white p-6">
            <div className="grid grid-cols-2">
              <button
                className={tab === "stake" ? "bg-green-sf" : ""}
                onClick={() => setTab("stake")}
              >
                Stake
              </button>
              <button
                className={tab === "unstake" ? "bg-green-sf" : ""}
                onClick={() => setTab("unstake")}
              >
                Unstake
              </button>
            </div>
            <div className="mt-28 text-center">
              {tab === "stake" ? (
                <>
                  <div className="text-green uppercase">
                    Accumulated Rewards
                  </div>
                  <div className="text-h6">
                    {rewards.data ? (
                      <FlowingBalance
                        balance={rewards.data.balance}
                        balanceTimestamp={rewards.data.timestamp}
                        flowRate={rewards.data.flowRate}
                      />
                    ) : (
                      "0.00"
                    )}
                  </div>
                  <div>SUP</div>
                </>
              ) : (
                <>
                  <div className="text-green uppercase">Staked Balance</div>
                  <div className="text-h5">
                    {formatTokenAmount(stakedBalance)}
                  </div>
                  <div>SUP</div>
                </>
              )}
            </div>
          </div>
          <div className="space-y-4 bg-platinum-light p-6">
            {tab === "stake" && (
              <div className="grid grid-cols-2 text-center">
                <div>
                  <strong>{formatTokenAmount(stakedBalance)}</strong>
                  <div className="text-green uppercase">Current Stake</div>
                </div>
                <div>
                  <strong>
                    <FlowingBalance
                      balance={availableBalance}
                      balanceTimestamp={Number(
                        lockerBalance.data?.timestamp ?? 0n,
                      )}
                      flowRate={lockerBalance.data?.flowRate ?? 0n}
                      decimalPlaces={0}
                    />
                  </strong>
                  <div className="text-green uppercase">Available Balance</div>
                </div>
              </div>
            )}
            {tab === "stake" ? (
              <AmountInputField
                value={stakeInput}
                onChange={setStakeInput}
                onMaxClick={() => setStakeInput(formatEther(availableBalance))}
                maxBalance={availableBalance}
                actionType="Stake"
              />
            ) : (
              <AmountInputField
                value={unstakeInput}
                onChange={setUnstakeInput}
                onMaxClick={() => setUnstakeInput(formatEther(stakedBalance))}
                maxBalance={stakedBalance}
                actionType="Unstake"
              />
            )}
            {tab === "stake" ? (
              <TransactionButton
                dataTestId="stake-button"
                chain={APP_CHAIN}
                onClick={stake.stake}
                status={stake.status}
                ButtonProps={{
                  loading:
                    isLockerCreated && stakeInput !== debouncedStakeInput,
                  disabled: !canStake || stakeSucceeded,
                }}
              >
                {stakeSucceeded ? "Successfully staked!" : "Stake"}
              </TransactionButton>
            ) : (
              <TransactionButton
                dataTestId="unstake-button"
                chain={APP_CHAIN}
                onClick={unstake.unstake}
                status={unstake.status}
                ButtonProps={{
                  loading:
                    isLockerCreated && unstakeInput !== debouncedUnstakeInput,
                  disabled: !canUnstake || unstakeSucceeded,
                }}
              >
                {unstakeSucceeded ? "Successfully unstaked!" : unstakeLabel}
              </TransactionButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
