"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { parseEther } from "viem";

import { APP_CHAIN } from "../../config/chains";
import { useLocker } from "../../contexts/LockerContext";
import { useClaimFlowMetrics } from "../../hooks/useClaimFlowMetrics";
import { useClaimTransaction } from "../../hooks/useClaimTransaction";
import { useCreateLocker } from "../../hooks/useCreateLocker";
import { useCurrentDelegate } from "../../hooks/useDelegation";
import { useLeaderboardEntry } from "../../hooks/useLeaderboardEntry";
import { useLockerBalance } from "../../hooks/useLockerBalance";
import { useProgramApps } from "../../hooks/useProgramApps";
import { useWalletAccount } from "../../hooks/useWalletAccount";
import {
  formatMonthlyFlowRate,
  formatTokenAmount,
  SUP_SYMBOL,
} from "../../lib/format";
import type { ProgramApp } from "../../types/program-app";
import { CampaignRecommendationStep } from "../campaign/CampaignRecommendationStep";
import { FlowingBalance } from "../FlowingBalance";
import { LoadingText } from "../layout/LoadingText";
import { SignUpToParticipateButton } from "../SignUpToParticipateButton";
import { TransactionButton } from "../TransactionButton";
import { DelegateStep } from "../governance/DelegateStep";
import { Countdown } from "./Countdown";

type OnboardingStep = "create-reserve" | "delegate" | "claim";

export function ClaimSection() {
  const { accountAddress, lockerAddress, isLockerCreated } = useLocker();
  const wallet = useWalletAccount();
  const lockerBalance = useLockerBalance({ lockerAddress });
  const metrics = useClaimFlowMetrics();
  const { hasExternalDelegate } = useCurrentDelegate({ accountAddress });
  const [onboardingStarted, setOnboardingStarted] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const hasClaimed =
    metrics.currentClaimedFlowRate > 0n ||
    (lockerBalance.data?.totalBalance ?? 0n) > 0n;
  const isLoading =
    wallet.isConnecting ||
    wallet.isReconnecting ||
    (wallet.isConnected &&
      (!metrics.readAccountProgramPointStates.isSuccess ||
        !metrics.readProgramPoolInfos.isSuccess));

  if (isLoading) return <ClaimLoading />;
  if (!wallet.isConnected) return <ConnectToClaim />;
  if ((hasClaimed && !onboardingStarted) || showDashboard) {
    return <ClaimDashboard />;
  }
  if (onboardingStarted) {
    return (
      <ClaimOnboarding
        initialStep={
          !isLockerCreated
            ? "create-reserve"
            : hasExternalDelegate
              ? "claim"
              : "delegate"
        }
        onClaimSuccess={() => setShowDashboard(true)}
      />
    );
  }
  return (
    <EligibilityCheck
      hasEligiblePrograms={Boolean(
        metrics.readAccountProgramPointStates.data?.programPointStates.some(
          (state) => state.offchainPoints > 0n,
        ),
      )}
      startingFlowRate={metrics.totalClaimableFlowRate}
      onContinue={() => setOnboardingStarted(true)}
    />
  );
}

function ClaimLoading() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl bg-platinum p-9">
      <span className="text-base uppercase">Season 6</span>
      <span className="text-[38px] font-medium">
        <LoadingText loading>Loading</LoadingText>
      </span>
      <img
        src="/coin-spin.png"
        alt="Spinning coin"
        className="h-[336px] w-[336px]"
      />
    </div>
  );
}

function ConnectToClaim() {
  return (
    <div className="flex h-full flex-col items-center justify-between gap-8 rounded-xl bg-platinum p-9">
      <div />
      <div className="text-center">
        <h2 className="text-h7">Check if you&apos;re eligible</h2>
        <img
          src="/fluid-bg-1.png"
          alt="Fluid cover"
          className="mx-auto max-w-full"
        />
      </div>
      <SignUpToParticipateButton />
    </div>
  );
}

function EligibilityCheck({
  hasEligiblePrograms,
  startingFlowRate,
  onContinue,
}: {
  hasEligiblePrograms: boolean;
  startingFlowRate: bigint;
  onContinue(): void;
}) {
  if (!hasEligiblePrograms) {
    return (
      <div className="flex h-full flex-col items-center justify-between gap-8 rounded-xl bg-[#E9E9E9] p-9 text-center">
        <div />
        <div>
          <h2 className="text-h7">Use apps to earn SUP</h2>
          <p className="uppercase">
            Explore ecosystem apps, give them a try and come back tomorrow! Your
            balance is updated daily
          </p>
          <img src="/fluid-bg-1.png" alt="Fluid cover" />
        </div>
        <Link
          data-testid="discover-apps-button"
          className="button"
          href="/apps"
        >
          Discover Apps to earn more {SUP_SYMBOL}
        </Link>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-between gap-8 rounded-xl bg-[#E9E9E9] p-9 text-center">
      <div />
      <div>
        <span className="uppercase">Season 6</span>
        <h2 className="text-h7">You&apos;re eligible!</h2>
        {startingFlowRate > 0n && (
          <>
            <img
              src="/coin-spin.png"
              alt="Spinning coin"
              className="mx-auto h-56 w-56"
            />
            <span className="uppercase">Starting rate:</span>
            <div data-testid="claimable-sup" className="text-h5 text-[#0A6643]">
              ~{formatMonthlyFlowRate(startingFlowRate)}
            </div>
            <span className="badge">{SUP_SYMBOL}/mo</span>
          </>
        )}
      </div>
      <button data-testid="continue-button" onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}

function ClaimOnboarding({
  initialStep,
  onClaimSuccess,
}: {
  initialStep: OnboardingStep;
  onClaimSuccess(): void;
}) {
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const next = useCallback(
    () =>
      setStep((current) =>
        current === "create-reserve" ? "delegate" : "claim",
      ),
    [],
  );
  return (
    <div className="flex h-full flex-col rounded-xl bg-[#E9E9E9]">
      <ol className="grid grid-cols-3 gap-2 p-6 text-center">
        <li className={step !== "create-reserve" ? "text-green" : ""}>
          Step 1<br />
          Create Reserve
        </li>
        <li className={step === "claim" ? "text-green" : ""}>
          Step 2<br />
          Delegate
        </li>
        <li>
          Step 3<br />
          Claim Stream
        </li>
      </ol>
      <div className="min-h-0 flex-1">
        {step === "create-reserve" ? (
          <CreateReserveStep onComplete={next} />
        ) : step === "delegate" ? (
          <DelegateStep stepper={{ next }} className="p-6" />
        ) : (
          <InitialClaimStep onClaimSuccess={onClaimSuccess} />
        )}
      </div>
    </div>
  );
}

function CreateReserveStep({ onComplete }: { onComplete(): void }) {
  const { accountAddress } = useLocker();
  const create = useCreateLocker(accountAddress);
  const [isCreated] = (create.readGetUserLocker.data as
    readonly [boolean, unknown] | undefined) ?? [false];
  const pending =
    create.writeCreateLocker.isPending ||
    create.waitForTransactionCreateLocker.isFetching;
  const success = isCreated || Boolean(create.status?.isFinished);
  useEffect(() => {
    if (success) onComplete();
  }, [onComplete, success]);
  return (
    <div className="flex h-full flex-col items-center justify-between gap-4 bg-[url('/reserve-bg.png')] bg-bottom bg-cover p-6 text-center">
      <div className="max-w-[420px]">
        <h2 className="text-h7">Your Reserve</h2>
        <p>Reserves are vaults that reward holders with a long-term outlook.</p>
        <p>
          All SUP rewards go straight to your reserve. Soon you will be able to
          decide whether you&apos;d like to withdraw, stake or provide liquidity
          to boost your earnings!
        </p>
      </div>
      {success ? (
        <button data-testid="continue-button" onClick={onComplete}>
          Success! Continue
        </button>
      ) : (
        <TransactionButton
          dataTestId="create-locker-button"
          chain={APP_CHAIN}
          onClick={create.createLocker}
          status={create.status}
          ButtonProps={{
            disabled: Boolean(isCreated || pending || !accountAddress),
          }}
        >
          Create Reserve
        </TransactionButton>
      )}
    </div>
  );
}

function InitialClaimStep({ onClaimSuccess }: { onClaimSuccess(): void }) {
  const { accountAddress, lockerAddress } = useLocker();
  const metrics = useClaimFlowMetrics();
  const claim = useClaimTransaction({ accountAddress, lockerAddress });
  const lockerBalance = useLockerBalance({ lockerAddress });
  const hasClaimed =
    metrics.currentClaimedFlowRate > 0n || Boolean(claim.status?.isFinished);
  const displayBalance =
    lockerBalance.data && lockerBalance.data.flowRate > 0n
      ? lockerBalance.data
      : {
          totalBalance: 0n,
          timestamp: BigInt(Math.floor(Date.now() / 1_000)),
          flowRate: hasClaimed
            ? metrics.currentClaimedFlowRate
            : metrics.totalClaimableFlowRate,
        };

  if (hasClaimed) {
    return (
      <div className="flex h-full flex-col items-center justify-between bg-[url('/claim-success.png')] bg-bottom bg-no-repeat p-6 text-center">
        <div className="flex flex-1 flex-col items-center gap-3 pb-8">
          <h2 className="text-h7">Claimed!</h2>
          <p className="uppercase">
            As more users join your flow rate may go down.
            <br />
            Be sure to return daily to maximise your rewards!
          </p>
          <div className="flex-1" />
          <span className="text-green uppercase">Your balance</span>
          <div className="text-h5">
            <FlowingBalance
              balance={displayBalance.totalBalance}
              balanceTimestamp={displayBalance.timestamp}
              flowRate={displayBalance.flowRate}
            />{" "}
            {SUP_SYMBOL}
          </div>
          <div className="text-green text-title3">
            {formatMonthlyFlowRate(metrics.totalClaimableFlowRate)} {SUP_SYMBOL}
          </div>
          <span className="uppercase">Your monthly flowrate</span>
        </div>
        <button data-testid="okay-button" onClick={onClaimSuccess}>
          Okay
        </button>
      </div>
    );
  }

  const hasNoChange = metrics.extraClaimableFlowRate === 0n;
  const isIncrease = metrics.extraClaimableFlowRate > 0n;
  return (
    <div className="flex h-full flex-col items-center justify-between p-6 text-center">
      <div>
        <span className="uppercase">Start Stream</span>
        <h2 className="text-h7">Time to claim your rewards!</h2>
      </div>
      <img src="/coin-spin.png" alt="Spinning coin" className="h-56 w-56" />
      {isIncrease && (
        <div>
          <span>Starting rate:</span>
          <div data-testid="claimable-sup" className="text-h5">
            ~{formatMonthlyFlowRate(metrics.totalClaimableFlowRate)}
          </div>
          <span>{SUP_SYMBOL}/mo</span>
        </div>
      )}
      <TransactionButton
        dataTestId="claim-button"
        chain={APP_CHAIN}
        onClick={claim.claim}
        status={claim.status}
        ButtonProps={{
          disabled: !claim.claimTransactionData.canClaim || hasNoChange,
        }}
      >
        {isIncrease || hasNoChange ? "Claim Stream" : "Update flow rate"}
      </TransactionButton>
    </div>
  );
}

function ClaimDashboard() {
  const { accountAddress, lockerAddress } = useLocker();
  const lockerBalance = useLockerBalance({ lockerAddress });
  const metrics = useClaimFlowMetrics();
  const leaderboard = useLeaderboardEntry({
    address: accountAddress,
    enabled: Boolean(lockerAddress),
  });
  const apps = useProgramApps();
  const claim = useClaimTransaction({ accountAddress, lockerAddress });
  const [recommendedApp, setRecommendedApp] = useState<ProgramApp | null>(null);
  const [recommendationDismissed, setRecommendationDismissed] = useState(false);
  const hasAvailableStake =
    (lockerBalance.data?.availableBalance ?? 0n) > parseEther("1");
  const claimAndStake = useClaimTransaction({
    accountAddress,
    lockerAddress,
    withStake: true,
    enabled: hasAvailableStake,
  });
  const recommendations = useMemo(() => {
    if (!apps.data || !metrics.readAccountProgramPointStates.data) return [];
    const participatedProgramIds = new Set(
      metrics.readAccountProgramPointStates.data.programPointStates
        .filter((state) => state.offchainPoints > 0n)
        .map((state) => state.programId),
    );
    return apps.data.filter(
      (app) =>
        app.program &&
        !participatedProgramIds.has(BigInt(app.program.id)) &&
        app.program.onchainInfo.isFundingStarted &&
        !app.program.onchainInfo.isFundingFinished &&
        !app.isExpired,
    );
  }, [apps.data, metrics.readAccountProgramPointStates.data]);
  const claimFinished = Boolean(
    claim.status?.isFinished || claimAndStake.status?.isFinished,
  );
  useEffect(() => {
    if (
      claim.writeLockerClaim.isPending ||
      claimAndStake.writeLockerClaim.isPending
    ) {
      setRecommendationDismissed(false);
    }
  }, [
    claim.writeLockerClaim.isPending,
    claimAndStake.writeLockerClaim.isPending,
  ]);
  useEffect(() => {
    if (
      !claim.status?.isFinished ||
      claimAndStake.status?.isFinished ||
      !recommendations.length ||
      recommendationDismissed
    )
      return;
    setRecommendedApp(
      recommendations[Math.floor(Math.random() * recommendations.length)],
    );
  }, [
    claim.status?.isFinished,
    claimAndStake.status?.isFinished,
    recommendationDismissed,
    recommendations,
  ]);

  if (recommendedApp) {
    return (
      <CampaignRecommendationStep
        app={recommendedApp}
        onClose={() => {
          setRecommendedApp(null);
          setRecommendationDismissed(true);
        }}
      />
    );
  }
  if (claimFinished) {
    return (
      <div className="flex h-full flex-col items-center justify-between rounded-xl bg-[#E9E9E9] bg-[url('/grow-success.png')] bg-bottom bg-no-repeat p-6 text-center">
        <h2 className="text-h7">
          Your stream was updated
          {claimAndStake.status?.isFinished ? " and balance staked!" : "!"}
        </h2>
        <p>
          As more users join your flow rate may go down.
          <br />
          Be sure to return daily to maximise your rewards!
        </p>
        <div>
          <span>Your new flowrate</span>
          <div data-testid="new-flow-rate" className="text-h5">
            {formatMonthlyFlowRate(metrics.totalClaimableFlowRate)}
          </div>
          <span>{SUP_SYMBOL}/mo</span>
        </div>
        {claimAndStake.status?.isFinished && (
          <Link data-testid="go-to-staking-button" href="/staking">
            Go to Staking
          </Link>
        )}
        <button
          data-testid="okay-button"
          onClick={() => {
            setRecommendedApp(null);
            setRecommendationDismissed(false);
            claim.writeLockerClaim.reset();
            claimAndStake.writeLockerClaim.reset();
          }}
        >
          Okay
        </button>
      </div>
    );
  }

  const extra = metrics.extraClaimableFlowRate;
  const canClaim = Boolean(
    (claim.claimTransactionData.canClaim ||
      claimAndStake.claimTransactionData.canClaim) &&
    !claimFinished,
  );
  const nextClaim = nextClaimTarget();
  const showTimer = !canClaim && shouldShowClaimTimer();
  const balance = lockerBalance.data;
  return (
    <div className="flex h-full flex-col items-center justify-between rounded-xl bg-[#E9E9E9] bg-[url('/fluid-bg-2.png')] bg-top bg-no-repeat p-6">
      <div className="h-40" />
      <div className="text-center">
        <span className="text-green uppercase">Your reserve balance</span>
        <div data-testid="sup-balance" className="text-h5">
          <FlowingBalance
            balance={balance?.totalBalance ?? 0n}
            flowRate={balance?.flowRate ?? 0n}
            balanceTimestamp={balance?.timestamp ?? 0n}
          />
        </div>
        <span className="badge">{SUP_SYMBOL}</span>
      </div>
      <div className="w-full">
        {extra >= 0n && (
          <p
            data-testid="claim-message"
            className="bg-purple p-3 text-center text-white"
          >
            {canClaim && extra > 0n ? (
              <>
                You&apos;ve added {formatMonthlyFlowRate(extra)} {SUP_SYMBOL}{" "}
                per month to your flowrate!
              </>
            ) : (
              <>
                No extra {SUP_SYMBOL} this time. Use apps to boost your
                earnings!
              </>
            )}
          </p>
        )}
        <div className="grid grid-cols-2 py-9 text-center">
          <div>
            <strong data-testid="monthly-flowrate">
              {formatMonthlyFlowRate(balance?.flowRate ?? 0n)}
            </strong>
            <p>Your flowrate per month</p>
          </div>
          <div>
            <strong data-testid="your-leaderboard-position">
              {leaderboard.data?.entry?.rank ?? "-"}
            </strong>
            <p>Leaderboard position</p>
          </div>
        </div>
        <TransactionButton
          className={
            !hasAvailableStake || extra === 0n || showTimer ? "invisible" : ""
          }
          dataTestId="claim-and-stake-button"
          chain={APP_CHAIN}
          onClick={claimAndStake.claim}
          status={claimAndStake.status}
          ButtonProps={{ disabled: !canClaim || extra === 0n }}
        >
          {extra > 0n ? "Claim and Stake" : "Update flow rate and Stake"}{" "}
          {formatTokenAmount(balance?.availableBalance ?? 0n)} SUP
        </TransactionButton>
        <TransactionButton
          dataTestId="claim-button"
          chain={APP_CHAIN}
          onClick={claim.claim}
          status={claim.status}
          ButtonProps={{
            disabled: !canClaim || extra === 0n,
            variant: hasAvailableStake ? "outline" : "default",
          }}
        >
          {canClaim ? (
            extra > 0n ? (
              hasAvailableStake ? (
                "Claim without staking"
              ) : (
                `Grow your stream by ${formatMonthlyFlowRate(extra)} ${SUP_SYMBOL}/mo`
              )
            ) : extra === 0n ? (
              "Nothing to claim"
            ) : hasAvailableStake ? (
              "Update without staking"
            ) : (
              "Update flow rate"
            )
          ) : showTimer ? (
            <>
              Next claim in <Countdown targetDate={nextClaim} />
            </>
          ) : (
            "Nothing to claim"
          )}
        </TransactionButton>
      </div>
    </div>
  );
}

function nextClaimTarget() {
  const target = new Date();
  target.setHours(0 - target.getTimezoneOffset() / 60, 40, 0, 0);
  const utcNow = new Date(
    Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
      new Date().getUTCHours(),
      new Date().getUTCMinutes(),
      new Date().getUTCSeconds(),
      new Date().getUTCMilliseconds(),
    ),
  );
  if (
    utcNow.getHours() >= 1 ||
    (utcNow.getHours() === 0 && utcNow.getMinutes() >= 40)
  ) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

function shouldShowClaimTimer() {
  const utcNow = new Date(
    Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
      new Date().getUTCHours(),
      new Date().getUTCMinutes(),
    ),
  );
  return (
    (utcNow.getHours() === 0 && utcNow.getMinutes() < 40) ||
    utcNow.getHours() >= 2
  );
}
