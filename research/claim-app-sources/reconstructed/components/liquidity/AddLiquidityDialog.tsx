"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { useBalance } from "wagmi";

import { APP_CHAIN } from "../../config/chains";
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
  const walletBalance = useBalance({
    address: accountAddress,
    chainId: APP_CHAIN.id,
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
  }, [provide.isFinished, provide.status?.isError, provideSucceeded]);

  useEffect(() => {
    if (!withdraw.isFinished || withdraw.status?.isError || withdrawSucceeded)
      return;
    setSelectedTokenId(null);
    setWithdrawSucceeded(true);
  }, [withdraw.isFinished, withdraw.status?.isError, withdrawSucceeded]);

  useEffect(() => {
    if (!collect.isFinished || collect.status?.isError || feesSucceeded) return;
    setFeesSucceeded(true);
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
    ? `cooldown: ${cooldownDays} days`
    : hasFees
      ? "[ withdraw liquidity and fees ]"
      : "[ withdraw liquidity ]";

  return (
    <div className="wallet-dialog-overlay">
      <section
        role="dialog"
        aria-labelledby="manage-liquidity-title"
        className="wallet-dialog"
      >
        <p className="command-line">
          <span className="prompt">&gt;</span>{" "}
          <strong id="manage-liquidity-title">manage liquidity</strong>{" "}
          <button aria-label="Close" onClick={onClose}>
            [ close ]
          </button>
        </p>
        <p>
          <button
            className={tab === "add" ? "positive" : undefined}
            onClick={() => setTab("add")}
          >
            [ add ]
          </button>{" "}
          <button
            className={tab === "withdraw" ? "positive" : undefined}
            onClick={() => setTab("withdraw")}
          >
            [ withdraw ]
          </button>
        </p>

        {tab === "add" ? (
          <section aria-label="Add liquidity">
            <label className="account-field">
              <span>ETH</span>
              <input
                inputMode="decimal"
                placeholder="0"
                value={ethInput}
                onChange={(event) => {
                  setEthInput(sanitizeTokenInput(event.target.value));
                  setPrimaryInput("eth");
                }}
              />
            </label>
            <p className="dim">
              available {formatTokenAmount(ethAvailable, 4)} ETH ·{" "}
              <button
                onClick={() => {
                  setEthInput(formatEther(ethAvailable));
                  setPrimaryInput("eth");
                }}
                disabled={!ethAvailable}
              >
                max
              </button>
            </p>
            <label className="account-field">
              <span>SUP</span>
              <input
                inputMode="decimal"
                placeholder="0"
                value={supInput}
                onChange={(event) => {
                  setSupInput(sanitizeTokenInput(event.target.value));
                  setPrimaryInput("sup");
                }}
              />
            </label>
            <p className="dim">
              available {formatTokenAmount(supAvailable)} SUP ·{" "}
              <button
                onClick={() => {
                  setSupInput(formatEther(supAvailable));
                  setPrimaryInput("sup");
                }}
                disabled={!supAvailable}
              >
                max
              </button>
            </p>
            <label>
              <input
                id="use-staked-balance"
                type="checkbox"
                checked={useStakedBalance}
                onChange={(event) => setUseStakedBalance(event.target.checked)}
              />{" "}
              use staked SUP balance
            </label>
            <p className="dim">
              1% fee · 7 day cooldown · Uniswap impermanent-loss risk
            </p>
            <TransactionButton
              dataTestId="provide-liquidity-button"
              chain={APP_CHAIN}
              onClick={provide.provideLiquidity}
              status={provide.status}
              ButtonProps={{ disabled: !canProvide || provideSucceeded }}
            >
              {provideSucceeded
                ? "liquidity provided"
                : !hasEnoughEth && ethAmount && supAmount
                  ? "insufficient ETH"
                  : "[ add liquidity ]"}
            </TransactionButton>
          </section>
        ) : (
          <section aria-label="Withdraw liquidity">
            <p>select a position</p>
            {activePositions.isLoading ? (
              <p className="dim">loading positions…</p>
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
              <p className="dim">no active positions</p>
            )}
            {selectedTokenId && hasFees && (
              <TransactionButton
                dataTestId="collect-fees-button"
                chain={APP_CHAIN}
                onClick={collect.collectFees}
                status={collect.status}
                ButtonProps={{ disabled: feesSucceeded }}
              >
                {feesSucceeded ? "fees withdrawn" : "[ withdraw fees ]"}
              </TransactionButton>
            )}
            <TransactionButton
              dataTestId="withdraw-liquidity-button"
              chain={APP_CHAIN}
              onClick={withdraw.withdrawLiquidity}
              status={withdraw.status}
              ButtonProps={{
                disabled: !selectedTokenId || withdrawSucceeded || onCooldown,
              }}
            >
              {withdrawSucceeded ? "liquidity withdrawn" : withdrawLabel}
            </TransactionButton>
          </section>
        )}
      </section>
    </div>
  );
}
