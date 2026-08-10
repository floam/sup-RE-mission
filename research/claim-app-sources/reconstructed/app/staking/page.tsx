"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { formatEther } from "viem";

import { FlowingBalance } from "../../components/FlowingBalance";
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

function Stats({ stats }: { stats?: StakingStats }) {
  const apr = stats ? Number(stats.apr) : Number.NaN;
  const bonusApr = stats ? Number(stats.bonusApr) : Number.NaN;
  return (
    <div className="route-lines">
      <p className="route-line">
        <strong>total staked</strong>
        <span>{stats ? formatTokenAmount(stats.totalStaked) : "N/A"} SUP</span>
      </p>
      <p className="route-line">
        <strong>distributed</strong>
        <span>
          {stats ? (
            <FlowingBalance
              balance={stats.totalDistributed}
              balanceTimestamp={stats.totalDistributedTimestamp}
              flowRate={stats.totalDistributedFlowRate}
              decimalPlaces={2}
            />
          ) : (
            "N/A"
          )}{" "}
          SUP
        </span>
      </p>
      <p className="route-line">
        <strong>cooldown</strong>
        <span>
          {stats
            ? `${stats.withdrawalPeriodDays} day${stats.withdrawalPeriodDays === 1 ? "" : "s"}`
            : "N/A"}
        </span>
      </p>
      <p className="route-line">
        <strong>APR</strong>
        <span>
          {Number.isNaN(apr)
            ? "N/A"
            : `${apr === 0 ? "0.00" : apr.toFixed(2)}%${Number.isNaN(bonusApr) || bonusApr === 0 ? "" : ` + ${bonusApr.toFixed(2)}%`}`}
        </span>
      </p>
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
    const timer = window.setTimeout(() => {
      stake.reset();
      setStakeSucceeded(false);
    }, 3_000);
    return () => window.clearTimeout(timer);
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
    const timer = window.setTimeout(() => {
      unstake.reset();
      setUnstakeSucceeded(false);
    }, 3_000);
    return () => window.clearTimeout(timer);
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

  return (
    <main className="terminal-page">
      <p className="command-line">
        <span className="prompt">&gt;</span> staking
      </p>
      <p>stake SUP and review the resulting rewards and cooldown state</p>

      <Stats stats={stats} />

      <div className="route-lines">
        <p className="route-line">
          <strong>available</strong>
          <span>
            <FlowingBalance
              balance={availableBalance}
              balanceTimestamp={Number(lockerBalance.data?.timestamp ?? 0n)}
              flowRate={lockerBalance.data?.flowRate ?? 0n}
              decimalPlaces={0}
            />{" "}
            SUP
          </span>
        </p>
        <p className="route-line">
          <strong>staked</strong>
          <span>{formatTokenAmount(stakedBalance)} SUP</span>
        </p>
        <p className="route-line">
          <strong>rewards</strong>
          <span>
            {rewards.data ? (
              <FlowingBalance
                balance={rewards.data.balance}
                balanceTimestamp={rewards.data.timestamp}
                flowRate={rewards.data.flowRate}
              />
            ) : (
              "0.00"
            )}{" "}
            SUP
          </span>
        </p>
      </div>

      <p>
        <button
          className={tab === "stake" ? "positive" : undefined}
          type="button"
          onClick={() => setTab("stake")}
        >
          [ stake ]
        </button>{" "}
        <button
          className={tab === "unstake" ? "positive" : undefined}
          type="button"
          onClick={() => setTab("unstake")}
        >
          [ unstake ]
        </button>
      </p>

      {tab === "stake" ? (
        <>
          <label className="account-field">
            <span>amount</span>
            <input
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              placeholder="0.00"
              value={stakeInput}
              onChange={(event) =>
                setStakeInput(sanitizeTokenInput(event.target.value))
              }
            />
          </label>
          <p>
            <button
              type="button"
              onClick={() => setStakeInput(formatEther(availableBalance))}
              disabled={availableBalance === 0n}
            >
              max
            </button>
          </p>
          <TransactionButton
            dataTestId="stake-button"
            chain={APP_CHAIN}
            onClick={stake.stake}
            status={stake.status}
            ButtonProps={{
              loading: isLockerCreated && stakeInput !== debouncedStakeInput,
              disabled: !canStake || stakeSucceeded,
            }}
          >
            {stakeSucceeded ? "staked" : "[ stake SUP ]"}
          </TransactionButton>
        </>
      ) : (
        <>
          <label className="account-field">
            <span>amount</span>
            <input
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              placeholder="0.00"
              value={unstakeInput}
              onChange={(event) =>
                setUnstakeInput(sanitizeTokenInput(event.target.value))
              }
            />
          </label>
          <p>
            <button
              type="button"
              onClick={() => setUnstakeInput(formatEther(stakedBalance))}
              disabled={stakedBalance === 0n}
            >
              max
            </button>
          </p>
          {cooldownActive && (
            <p className="warning">cooldown: {cooldownDays} days remaining</p>
          )}
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
            {unstakeSucceeded ? "unstaked" : "[ unstake SUP ]"}
          </TransactionButton>
        </>
      )}
    </main>
  );
}
