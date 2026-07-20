"use client";

import confetti from "canvas-confetti";
import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { useBalance } from "wagmi";

import { useExpectedChains } from "../../contexts/ExpectedChainContext";
import { useLocker } from "../../contexts/LockerContext";
import { UNLOCKING_FEE } from "../../contracts/app-contracts";
import { useActiveLiquidityPositions } from "../../hooks/useLiquidityPositions";
import {
  useEthSupPool,
  useLiquidityPosition,
} from "../../hooks/useLiquidityPosition";
import {
  useCollectFees,
  useProvideLiquidity,
  useWithdrawLiquidity,
} from "../../hooks/useLiquidityTransactions";
import { useLockerBalance } from "../../hooks/useLockerBalance";
import {
  calculateCorrespondingLiquidityAmount,
  type LiquidityInputToken,
} from "../../lib/liquidity-math";
import {
  formatTokenAmount,
  parseTokenAmount,
  sanitizeTokenInput,
} from "../../lib/format";
import { TransactionButton } from "../TransactionButton";
import { TokenIcon } from "../TokenIcon";
import { WithdrawPositionListItem } from "./WithdrawPositionListItem";

type LiquidityTab = "add" | "withdraw";

function parseInput(value: string): bigint | undefined {
  if (!value || value === ".") return undefined;
  try {
    return parseTokenAmount(value);
  } catch {
    return undefined;
  }
}

export function AddLiquidityDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose(): void;
}) {
  const [tab, setTab] = useState<LiquidityTab>("add");
  const [ethInput, setEthInput] = useState("");
  const [supInput, setSupInput] = useState("");
  const [primaryInput, setPrimaryInput] = useState<LiquidityInputToken | null>(
    null,
  );
  const [useStakedBalance, setUseStakedBalance] = useState(true);
  const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null);
  const [provideSucceeded, setProvideSucceeded] = useState(false);
  const [withdrawSucceeded, setWithdrawSucceeded] = useState(false);
  const [feesSucceeded, setFeesSucceeded] = useState(false);
  const { accountAddress, lockerAddress } = useLocker();
  const { airdropChain } = useExpectedChains();
  const walletBalance = useBalance({
    address: accountAddress,
    chainId: airdropChain.id,
  });
  const lockerBalance = useLockerBalance({ lockerAddress });
  const activePositions = useActiveLiquidityPositions(lockerAddress);
  const selectedPosition = useLiquidityPosition(
    selectedTokenId ?? undefined,
    lockerAddress,
  );
  const pool = useEthSupPool();
  const ethAmount = parseInput(ethInput);
  const supAmount = parseInput(supInput);

  const correspondingAmount = useMemo(() => {
    if (
      !primaryInput ||
      !pool.sdkPool ||
      !pool.sdkToken0 ||
      !pool.sdkToken1 ||
      pool.isSUPToken0 === undefined
    )
      return undefined;
    const amount = primaryInput === "eth" ? ethAmount : supAmount;
    if (!amount) return undefined;
    try {
      return calculateCorrespondingLiquidityAmount({
        pool: pool.sdkPool,
        sdkToken0: pool.sdkToken0,
        sdkToken1: pool.sdkToken1,
        isSUPToken0: pool.isSUPToken0,
        inputAmount: amount,
        inputToken: primaryInput,
      });
    } catch (error) {
      console.error("Error calculating corresponding amount:", error);
      return undefined;
    }
  }, [
    ethAmount,
    pool.isSUPToken0,
    pool.sdkPool,
    pool.sdkToken0,
    pool.sdkToken1,
    primaryInput,
    supAmount,
  ]);
  useEffect(() => {
    if (primaryInput === "eth")
      setSupInput(
        correspondingAmount?.token === "sup"
          ? formatEther(correspondingAmount.amount)
          : "",
      );
    if (primaryInput === "sup")
      setEthInput(
        correspondingAmount?.token === "eth"
          ? formatEther(correspondingAmount.amount)
          : "",
      );
  }, [correspondingAmount, primaryInput]);

  const provide = useProvideLiquidity({
    accountAddress,
    lockerAddress,
    ethAmount,
    supAmount,
  });
  const withdraw = useWithdrawLiquidity({
    accountAddress,
    lockerAddress,
    tokenId: selectedTokenId ?? undefined,
    liquidityToRemove: selectedPosition.data?.liquidity,
    amount0ToRemove: selectedPosition.data?.amount0,
    amount1ToRemove: selectedPosition.data?.amount1,
  });
  const collect = useCollectFees({
    accountAddress,
    lockerAddress,
    tokenId: selectedTokenId ?? undefined,
  });

  useEffect(() => {
    if (!provide.isFinished || provide.status?.isError || provideSucceeded)
      return;
    setEthInput("");
    setSupInput("");
    setPrimaryInput(null);
    setProvideSucceeded(true);
    void confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#22c55e", "#10b981", "#34d399"],
    });
  }, [provide.isFinished, provide.status?.isError, provideSucceeded]);
  useEffect(() => {
    if (!withdraw.isFinished || withdraw.status?.isError || withdrawSucceeded)
      return;
    setSelectedTokenId(null);
    setWithdrawSucceeded(true);
    void confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#22c55e", "#10b981", "#34d399"],
    });
  }, [withdraw.isFinished, withdraw.status?.isError, withdrawSucceeded]);
  useEffect(() => {
    if (!collect.isFinished || collect.status?.isError || feesSucceeded) return;
    setFeesSucceeded(true);
    void confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#22c55e", "#10b981", "#34d399"],
    });
  }, [collect.isFinished, collect.status?.isError, feesSucceeded]);
  useEffect(() => {
    setWithdrawSucceeded(false);
    setFeesSucceeded(false);
    withdraw.reset();
    collect.reset();
    // The write reset functions are stable wagmi actions; token selection is the intended trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTokenId]);
  useEffect(() => {
    if (isOpen) return;
    setTab("add");
    setEthInput("");
    setSupInput("");
    setPrimaryInput(null);
    setUseStakedBalance(true);
    setSelectedTokenId(null);
    setProvideSucceeded(false);
    setWithdrawSucceeded(false);
    setFeesSucceeded(false);
    provide.reset();
    withdraw.reset();
    collect.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  if (!isOpen) return null;

  const ethAvailable = walletBalance.data?.value ?? 0n;
  const supAvailable =
    (lockerBalance.data?.availableBalance ?? 0n) +
    (useStakedBalance ? (lockerBalance.data?.stakedBalance ?? 0n) : 0n);
  // The production bundle adds the estimated-gas bigint directly, then adds the fixed 0.0001 ETH fee.
  const requiredEth =
    (ethAmount ?? 0n) + (provide.estimate.data ?? 0n) + UNLOCKING_FEE;
  const hasEnoughEth =
    walletBalance.data?.value === undefined ||
    walletBalance.data.value >= requiredEth;
  const canProvide = Boolean(
    ethAmount &&
      ethAmount > 0n &&
      ethAmount <= ethAvailable &&
      supAmount &&
      supAmount > 0n &&
      supAmount <= supAvailable &&
      hasEnoughEth,
  );
  const hasFees = Boolean(
    selectedPosition.data &&
      (selectedPosition.data.feesETH > 0n ||
        selectedPosition.data.feesSUP > 0n),
  );
  const onCooldown = Boolean(
    selectedTokenId &&
      selectedPosition.data?.cooldownTimestamp &&
      !withdraw.isCooldownExpired,
  );
  const cooldownDays =
    onCooldown && selectedPosition.data?.cooldownTimestamp
      ? Math.ceil(
          (Number(selectedPosition.data.cooldownTimestamp) -
            Date.now() / 1_000) /
            86_400,
        )
      : 0;
  const withdrawLabel = onCooldown
    ? `Cooldown (${cooldownDays} days)`
    : hasFees
      ? "Withdraw Liquidity & Fees"
      : "Withdraw Liquidity";

  return (
    <div
      role="dialog"
      aria-labelledby="manage-liquidity-title"
      className="modal max-w-4xl bg-gradient-to-t from-green-pale via-platinum-light to-platinum p-4 sm:p-6"
    >
      <button aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h1 id="manage-liquidity-title" className="sr-only">
        Manage Liquidity
      </h1>
      <p className="sr-only">Manage liquidity providing</p>
      <div className="grid grid-cols-2 rounded-lg bg-white p-1">
        <button
          className={tab === "add" ? "bg-green-sf" : ""}
          onClick={() => setTab("add")}
        >
          ADD
        </button>
        <button
          className={tab === "withdraw" ? "bg-green-sf" : ""}
          onClick={() => setTab("withdraw")}
        >
          WITHDRAW
        </button>
      </div>

      {tab === "add" ? (
        <div className="mt-6 flex min-h-[440px] flex-col gap-6">
          <div className="text-center">
            <h2 className="text-title3">Provide to Earn</h2>
          </div>
          <div className="space-y-2 rounded-lg bg-white p-6">
            <div className="flex items-center justify-between rounded-lg border border-platinum bg-[#F7F8FA] p-4">
              <div className="flex gap-2">
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={ethInput}
                  onChange={(event) => {
                    setEthInput(sanitizeTokenInput(event.target.value));
                    setPrimaryInput("eth");
                  }}
                />
                <button
                  onClick={() => {
                    setEthInput(formatEther(ethAvailable));
                    setPrimaryInput("eth");
                  }}
                  disabled={!ethAvailable}
                >
                  MAX
                </button>
              </div>
              <div className="text-right">
                <strong className="flex items-center gap-1">
                  <TokenIcon token="eth" />
                  ETH
                </strong>
                <small>
                  {walletBalance.data
                    ? `${formatTokenAmount(ethAvailable, 4)} ETH`
                    : "-"}
                </small>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-platinum bg-[#F7F8FA] p-4">
              <div className="flex gap-2">
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={supInput}
                  onChange={(event) => {
                    setSupInput(sanitizeTokenInput(event.target.value));
                    setPrimaryInput("sup");
                  }}
                />
                <button
                  onClick={() => {
                    setSupInput(formatEther(supAvailable));
                    setPrimaryInput("sup");
                  }}
                  disabled={!supAvailable}
                >
                  MAX
                </button>
              </div>
              <div className="text-right">
                <strong className="flex items-center gap-1">
                  <TokenIcon token="sup" />
                  SUP
                </strong>
                <small>
                  {supAvailable > 0n
                    ? `${formatTokenAmount(supAvailable)} SUP`
                    : "-"}
                </small>
              </div>
            </div>
            <label className="mt-12 flex justify-end gap-2">
              Use staked SUP balance to provide liquidity
              <input
                id="use-staked-balance"
                type="checkbox"
                checked={useStakedBalance}
                onChange={(event) => setUseStakedBalance(event.target.checked)}
              />
            </label>
          </div>
          <p className="text-center text-caption2">
            Providing liquidity makes you eligible for a portion of the
            Community Charges from users who drain. 1% fee, 7 days cooldown.
            There is impermanent loss risk on Uniswap.
          </p>
          <TransactionButton
            dataTestId="provide-liquidity-button"
            chain={airdropChain}
            onClick={provide.provideLiquidity}
            status={provide.status}
            ButtonProps={{ disabled: !canProvide || provideSucceeded }}
          >
            {provideSucceeded
              ? "Successfully provided!"
              : !hasEnoughEth && ethAmount && supAmount
                ? "Insufficient ETH"
                : "Add Liquidity"}
          </TransactionButton>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          <div className="text-center">
            <h2 className="mb-2 text-title3">Select Position to Withdraw</h2>
            <p className="text-alto text-base uppercase">
              SELECT POSITION YOU WANT TO WITHDRAW FROM. IF YOU WITHDRAW BEFORE
              6 MONTHS HAVE PASSED YOUR FUNDS WILL GO BACK TO YOUR RESERVE.
            </p>
          </div>
          <div className="max-h-[300px] space-y-2 overflow-y-auto rounded-lg bg-white p-6">
            {activePositions.isLoading ? (
              <div>Loading positions...</div>
            ) : activePositions.data?.tokenIds.length ? (
              activePositions.data.tokenIds.map((tokenId) => (
                <WithdrawPositionListItem
                  key={tokenId.toString()}
                  tokenId={tokenId}
                  isSelected={selectedTokenId === tokenId}
                  onSelect={() =>
                    setSelectedTokenId(
                      selectedTokenId === tokenId ? null : tokenId,
                    )
                  }
                />
              ))
            ) : (
              <div className="flex min-h-[200px] items-center justify-center text-gray-500">
                No active positions found
              </div>
            )}
          </div>
          {selectedTokenId && hasFees && (
            <TransactionButton
              dataTestId="collect-fees-button"
              chain={airdropChain}
              onClick={collect.collectFees}
              status={collect.status}
              ButtonProps={{ disabled: feesSucceeded }}
            >
              {feesSucceeded ? "Fees Withdrawn!" : "Withdraw Fees"}
            </TransactionButton>
          )}
          <TransactionButton
            dataTestId="withdraw-liquidity-button"
            chain={airdropChain}
            onClick={withdraw.withdrawLiquidity}
            status={withdraw.status}
            ButtonProps={{
              disabled: !selectedTokenId || withdrawSucceeded || onCooldown,
            }}
          >
            {withdrawSucceeded ? "Successfully withdrawn!" : withdrawLabel}
          </TransactionButton>
        </div>
      )}
    </div>
  );
}
