"use client";

import { lockerAbi } from "@sfpro/sdk/abi/sup";
import { waitForTransactionReceipt } from "@wagmi/core";
import { useAppKit } from "@reown/appkit/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getAddress, isAddress, type Address } from "viem";
import { base } from "viem/chains";
import { useConfig, useSwitchChain, useWriteContract } from "wagmi";

import { ZERO_ADDRESS } from "../contracts/app-contracts";
import { useWalletAccount } from "../hooks/useWalletAccount";
import {
  cmsClient,
  requireCmsData,
  requireCmsSignature,
} from "../lib/cms-client";
import { ClaimCampaignChange } from "./ClaimCampaignChange";
import { validateCmsCampaignBatch } from "./claim-batch";
import {
  buildClaimState,
  type ClaimState,
  type PointState,
} from "./claim-chain";
import {
  formatCompactMonthlyFlow,
  shortAddress,
  STATIC_PROGRAM_ATTRIBUTIONS,
} from "./claim-display";
import type { EventBreakdown } from "./claim-event-breakdown";
import { explainPendingCampaigns } from "./pending-event-explanations";
import {
  chunkItems,
  CMS_BATCH_SIZE,
  getClaimResultKind,
  getClaimSubmissionErrorOutcome,
} from "./claim-program-plan";
import {
  getDefaultClaimSelection,
  isClaimablePointState,
  reconcileClaimSelection,
} from "./claim-state";
import {
  getPublicProgramAttributions,
  mergeProgramAttributions,
  type ProgramAttributions,
} from "./program-attribution";

export function ClaimExperience() {
  const [account, setAccount] = useState("");
  const [state, setState] = useState<ClaimState>();
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<
    "status" | "success" | "warning" | "error"
  >("status");
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requiresRefresh, setRequiresRefresh] = useState(false);
  const [selectedPrograms, setSelectedPrograms] = useState<Set<bigint>>(
    () => new Set(),
  );
  const [campaignAttributions, setCampaignAttributions] =
    useState<ProgramAttributions>(STATIC_PROGRAM_ATTRIBUTIONS);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [breakdowns, setBreakdowns] = useState<Map<bigint, EventBreakdown>>(
    () => new Map(),
  );
  const checkRequest = useRef(0);
  const eventRequest = useRef(0);
  const autoReview = useRef<{
    completed?: Address;
    inFlight?: Address;
  }>({});
  const { open } = useAppKit();
  const router = useRouter();
  const config = useConfig();
  const {
    address: connectedAddress,
    chainId,
    isConnected,
    isConnecting,
    isReconnecting,
  } = useWalletAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  function clearBreakdowns() {
    eventRequest.current += 1;
    setBreakdowns(new Map());
  }

  function applyClaimState(
    nextState: ClaimState,
    previousSelection?: ReadonlySet<bigint>,
  ) {
    setState(nextState);
    setSelectedPrograms(
      previousSelection === undefined
        ? getDefaultClaimSelection(nextState.programPointStates)
        : reconcileClaimSelection(
            nextState.programPointStates,
            previousSelection,
          ),
    );
    setRequiresRefresh(false);
  }

  function startLookup() {
    checkRequest.current += 1;
    clearBreakdowns();
    setAccount("");
    setState(undefined);
    setMessage("");
    setMessageKind("status");
    setRequiresRefresh(false);
    setIsLookupOpen(true);
  }

  function updateAccount(nextAccount: string) {
    checkRequest.current += 1;
    clearBreakdowns();
    setAccount(nextAccount);
    setState(undefined);
    setMessage("");
    setMessageKind("status");
    setRequiresRefresh(false);
  }

  async function reviewAccount(candidate = account) {
    if (!isAddress(candidate)) {
      setMessage("Enter a valid wallet address.");
      setMessageKind("error");
      return false;
    }

    const reviewedAccount = getAddress(candidate);
    const request = ++checkRequest.current;
    clearBreakdowns();
    setAccount(reviewedAccount);
    setState((current) =>
      current?.account === reviewedAccount ? current : undefined,
    );
    setIsChecking(true);
    setMessage("");
    setMessageKind("status");
    try {
      const nextState = await buildClaimState(config, reviewedAccount);
      if (request !== checkRequest.current) return false;
      applyClaimState(nextState);
      setIsLookupOpen(false);
      return true;
    } catch (error) {
      if (request === checkRequest.current) {
        setMessage(error instanceof Error ? error.message : String(error));
        setMessageKind("error");
      }
      return false;
    } finally {
      if (request === checkRequest.current) setIsChecking(false);
    }
  }

  function cancelLookup() {
    setIsLookupOpen(false);
    if (connectedAddress) {
      void reviewAccount(connectedAddress);
    } else {
      updateAccount("");
    }
  }

  useEffect(() => {
    let disposed = false;
    getPublicProgramAttributions()
      .then((live) => {
        if (!disposed) {
          setCampaignAttributions(
            mergeProgramAttributions(STATIC_PROGRAM_ATTRIBUTIONS, live),
          );
        }
      })
      .catch(() => {
        // Attribution is non-authoritative display data. Keep the recovered
        // labels when the public program feed is temporarily unavailable.
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!isConnected || !connectedAddress) {
      autoReview.current = {};
      return;
    }

    const nextAccount = getAddress(connectedAddress);
    if (
      autoReview.current.completed === nextAccount ||
      autoReview.current.inFlight === nextAccount
    ) {
      return;
    }

    autoReview.current.inFlight = nextAccount;
    setIsLookupOpen(false);
    void reviewAccount(nextAccount).then((completed) => {
      if (completed) autoReview.current.completed = nextAccount;
      if (autoReview.current.inFlight === nextAccount) {
        autoReview.current.inFlight = undefined;
      }
    });
  }, [connectedAddress, isConnected]);

  useEffect(() => {
    if (
      !state ||
      !isAddress(account) ||
      getAddress(account) !== state.account
    ) {
      setBreakdowns(new Map());
      return;
    }

    const explanatoryRows = state.programPointStates.filter(
      (row) =>
        row.cmsCampaignExists && row.isOnchainOutdated && !row.isCapped,
    );
    if (explanatoryRows.length === 0) {
      setBreakdowns(new Map());
      return;
    }

    const request = ++eventRequest.current;
    setBreakdowns(
      new Map(
        explanatoryRows.map((row) => [
          row.programId,
          {
            selection: { account: state.account, programId: row.programId },
            events: [],
            message: "loading event details…",
          },
        ]),
      ),
    );

    void explainPendingCampaigns(
      config,
      state.account,
      explanatoryRows,
    )
      .then((explanations) => {
        if (request !== eventRequest.current) return;
        const next = new Map<bigint, EventBreakdown>();
        for (const explanation of explanations) {
          next.set(explanation.selection.programId, explanation);
        }
        for (const row of explanatoryRows) {
          if (!next.has(row.programId)) {
            next.set(row.programId, {
              selection: { account: state.account, programId: row.programId },
              events: [],
              message: "event details were not returned for this campaign",
            });
          }
        }
        setBreakdowns(next);
      })
      .catch((error) => {
        if (request !== eventRequest.current) return;
        const detail = error instanceof Error ? error.message : String(error);
        setBreakdowns(
          new Map(
            explanatoryRows.map((row) => [
              row.programId,
              {
                selection: {
                  account: state.account,
                  programId: row.programId,
                },
                events: [],
                message: detail,
              },
            ]),
          ),
        );
      });
  }, [account, config, state]);

  async function claim() {
    if (
      isSubmitting ||
      requiresRefresh ||
      !state?.canClaim ||
      !state.lockerCreated ||
      state.lockerAddress === ZERO_ADDRESS ||
      !isAddress(account) ||
      getAddress(account) !== state.account ||
      !connectedAddress ||
      getAddress(connectedAddress) !== state.account
    ) {
      return;
    }

    const selections = chunkItems(
      state.programPointStates.filter(
        (row) =>
          isClaimablePointState(row) && selectedPrograms.has(row.programId),
      ),
      CMS_BATCH_SIZE,
    );
    const request = ++checkRequest.current;
    const submittedSelection = new Set(selectedPrograms);
    let confirmedBatches = 0;
    let confirmationIncomplete = false;
    setIsSubmitting(true);
    setMessageKind("status");
    clearBreakdowns();

    try {
      if (chainId !== base.id) await switchChainAsync({ chainId: base.id });
      for (const [index, selection] of selections.entries()) {
        const campaignIds = selection.map((row) => Number(row.programId));
        setMessage(
          `Preparing wallet confirmation ${index + 1} of ${selections.length}…`,
        );
        const signedResult = await cmsClient.POST(
          "/points/signed-balance-batch",
          {
            body: { account: state.account, campaignIds },
          },
        );
        const signed = requireCmsData(
          "/points/signed-balance-batch",
          signedResult,
        );
        const signature = requireCmsSignature(signed.signature);
        validateCmsCampaignBatch({
          label: "CMS signed balance batch",
          expectedAccount: state.account,
          expectedCampaignIds: campaignIds,
          responseAccount: signed.address,
          campaignIds: signed.campaignIds,
          pointArrays: [signed.points, signed.uncappedPoints],
        });

        const hash = await writeContractAsync({
          account: state.account,
          chain: base,
          address: state.lockerAddress,
          abi: lockerAbi,
          functionName: "claim",
          args: [
            signed.campaignIds.map(BigInt),
            signed.points.map(BigInt),
            BigInt(signed.signatureTimestamp),
            signature,
          ],
          chainId: base.id,
        });
        setMessage(
          `Transaction ${index + 1} of ${selections.length} submitted. Waiting for confirmation…`,
        );
        let receipt: Awaited<ReturnType<typeof waitForTransactionReceipt>>;
        try {
          receipt = await waitForTransactionReceipt(config, {
            chainId: base.id,
            hash,
          });
        } catch (error) {
          confirmationIncomplete = true;
          throw error;
        }
        if (receipt.status !== "success") {
          throw new Error(`Transaction ${index + 1} reverted.`);
        }
        confirmedBatches += 1;
      }

      try {
        const refreshed = await buildClaimState(config, state.account);
        if (request !== checkRequest.current) return;
        applyClaimState(refreshed, submittedSelection);
      } catch (error) {
        if (request !== checkRequest.current) return;
        const detail = error instanceof Error ? error.message : String(error);
        setRequiresRefresh(true);
        setSelectedPrograms(new Set());
        setMessage(
          `Claim confirmed, but the displayed stream state is stale. Refresh it before another transaction. ${detail}`,
        );
        setMessageKind("warning");
        return;
      }
      setMessage(
        `Claim succeeded. ${confirmedBatches} transaction${confirmedBatches === 1 ? "" : "s"} confirmed and the SUP stream state was refreshed.`,
      );
      setMessageKind("success");
    } catch (error) {
      if (request !== checkRequest.current) return;
      let refreshRecovered = false;
      if (confirmedBatches > 0 && !confirmationIncomplete) {
        try {
          const refreshed = await buildClaimState(config, state.account);
          if (request === checkRequest.current) {
            applyClaimState(refreshed, submittedSelection);
            refreshRecovered = true;
          }
        } catch {
          // Preserve the transaction error when a follow-up refresh also fails.
        }
      }
      if (request === checkRequest.current) {
        const detail = error instanceof Error ? error.message : String(error);
        const outcome = getClaimSubmissionErrorOutcome({
          confirmedBatches,
          confirmationIncomplete,
          detail,
        });
        if (outcome.requiresRefresh && !refreshRecovered) {
          setRequiresRefresh(true);
          setSelectedPrograms(new Set());
        }
        setMessage(outcome.message);
        setMessageKind(outcome.kind);
      }
    } finally {
      if (request === checkRequest.current) setIsSubmitting(false);
    }
  }

  async function refreshClaimState() {
    if (!state || isChecking || isSubmitting) return;

    const request = ++checkRequest.current;
    const previousSelection = new Set(selectedPrograms);
    setIsChecking(true);
    setMessage("Refreshing the onchain stream state…");
    setMessageKind("status");
    clearBreakdowns();

    try {
      const refreshed = await buildClaimState(config, state.account);
      if (request !== checkRequest.current) return;
      applyClaimState(refreshed, previousSelection);
      setMessage(
        "Stream state refreshed. Review the remaining updates before claiming.",
      );
      setMessageKind("success");
    } catch (error) {
      if (request !== checkRequest.current) return;
      const detail = error instanceof Error ? error.message : String(error);
      setRequiresRefresh(true);
      setMessage(`The stream state is still stale. ${detail}`);
      setMessageKind("warning");
    } finally {
      if (request === checkRequest.current) setIsChecking(false);
    }
  }

  const stateMatchesAccount =
    state !== undefined &&
    isAddress(account) &&
    getAddress(account) === state.account;
  const connectedOwnsAccount =
    stateMatchesAccount &&
    connectedAddress !== undefined &&
    getAddress(connectedAddress) === state.account;
  const populatedRows = stateMatchesAccount
    ? state.programPointStates.filter(
        (row) =>
          row.uncappedPoints > 0n ||
          row.offchainPoints > 0n ||
          row.onchainPoints > 0n,
      )
    : [];
  const changedRows = populatedRows.filter(isClaimablePointState);
  const selectedRows = changedRows.filter((row) =>
    selectedPrograms.has(row.programId),
  );
  const cappedRows = populatedRows.filter((row) => row.isCapped);
  const updateRows = populatedRows.filter(
    (row) => row.isCapped || isClaimablePointState(row),
  );
  const totalFlowDelta = selectedRows.reduce(
    (sum, row) => sum + row.projectedFlowRate - row.currentFlowRate,
    0n,
  );
  const transactionCount = Math.ceil(selectedRows.length / CMS_BATCH_SIZE);
  const walletBusy = isConnecting || isReconnecting;
  const resultKind = stateMatchesAccount
    ? getClaimResultKind({
        lockerReady:
          state.lockerCreated && state.lockerAddress !== ZERO_ADDRESS,
        comparableProgramCount: state.programPointStates.length,
        changedProgramCount: changedRows.length,
      })
    : undefined;

  function renderCampaign(row: PointState) {
    return (
      <ClaimCampaignChange
        key={String(row.programId)}
        row={row}
        attributions={campaignAttributions}
        isSelected={
          isClaimablePointState(row)
            ? selectedPrograms.has(row.programId)
            : undefined
        }
        isSelectionDisabled={isSubmitting || requiresRefresh}
        onSelectionChange={
          isClaimablePointState(row)
            ? (selected) =>
                setSelectedPrograms((current) => {
                  const next = new Set(current);
                  if (selected) next.add(row.programId);
                  else next.delete(row.programId);
                  return next;
                })
            : undefined
        }
        breakdown={breakdowns.get(row.programId)}
      />
    );
  }

  const showLookup = !stateMatchesAccount && (!isConnected || isLookupOpen);
  const reviewedAccount = stateMatchesAccount
    ? shortAddress(state.account)
    : connectedAddress
      ? shortAddress(connectedAddress)
      : "not connected";
  const summary =
    resultKind === "updates-found"
      ? `${selectedRows.length}/${changedRows.length} · ${formatCompactMonthlyFlow(totalFlowDelta, true)} · ${transactionCount} tx`
      : stateMatchesAccount
        ? "state current"
        : "unofficial client";

  return (
    <div className="terminal-claim">
      <p className="claim-status-line" aria-label="Claim client status">
        <span>claim · {reviewedAccount} · base</span>
        <span>{summary}</span>
      </p>

      {showLookup && (
        <section className="wallet-step">
          {!isLookupOpen ? (
            <div className="wallet-actions">
              <button
                className="primary-action"
                type="button"
                disabled={walletBusy}
                onClick={() => open({ view: "Connect" })}
              >
                {walletBusy ? "[ connecting… ]" : "[ connect wallet ]"}
              </button>
              <button
                className="secondary-action"
                type="button"
                onClick={startLookup}
              >
                look up address
              </button>
            </div>
          ) : (
            <>
              <label className="account-field">
                <span>wallet</span>
                <input
                  autoFocus
                  value={account}
                  disabled={isSubmitting}
                  onChange={(event) => updateAccount(event.target.value)}
                  placeholder="0x…"
                  inputMode="text"
                />
              </label>
              <div className="wallet-actions">
                <button
                  className="primary-action"
                  type="button"
                  disabled={isChecking || isSubmitting || !isAddress(account)}
                  onClick={() => void reviewAccount()}
                >
                  {isChecking ? "[ checking… ]" : "[ review address ]"}
                </button>
                <button
                  className="secondary-action"
                  type="button"
                  disabled={isChecking || isSubmitting}
                  onClick={cancelLookup}
                >
                  cancel
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {message && (
        <p
          className={`claim-status claim-status-${messageKind}`}
          role={
            messageKind === "error" || messageKind === "warning"
              ? "alert"
              : "status"
          }
        >
          <span>{message}</span>{" "}
          {isConnected &&
            connectedAddress &&
            !stateMatchesAccount &&
            !isLookupOpen && (
              <button
                className="text-button"
                type="button"
                disabled={isChecking}
                onClick={() => void reviewAccount(connectedAddress)}
              >
                retry
              </button>
            )}
        </p>
      )}

      {stateMatchesAccount && state && (
        <div className="results" aria-live="polite">
          <div className="wallet-actions lookup-command">
            <button
              className="secondary-action"
              type="button"
              disabled={isSubmitting}
              onClick={startLookup}
            >
              check another wallet
            </button>
          </div>

          {resultKind === "locker-required" ? (
            <div className="reserve-required">
              <p>A Reserve is required before rewards can stream.</p>
              <button
                className="primary-action"
                type="button"
                onClick={
                  connectedOwnsAccount
                    ? () => router.push("/reserve")
                    : () => open({ view: "Connect" })
                }
              >
                {connectedOwnsAccount
                  ? "[ create Reserve ]"
                  : "[ connect this wallet ]"}
              </button>
            </div>
          ) : resultKind === "updates-found" ? (
            <>
              <section className="campaign-list" aria-label="Campaign updates">
                <div className="campaigns">{updateRows.map(renderCampaign)}</div>
              </section>

              <footer className="submit-update">
                <p className="claim-command-summary">
                  <span>
                    claim {selectedRows.length} campaign
                    {selectedRows.length === 1 ? "" : "s"}
                  </span>
                  <span>·</span>
                  <span className={totalFlowDelta < 0n ? "negative" : "positive"}>
                    {formatCompactMonthlyFlow(totalFlowDelta, true)}
                  </span>
                  <span>·</span>
                  <span>
                    {transactionCount} transaction
                    {transactionCount === 1 ? "" : "s"}
                  </span>
                </p>
                <button
                  className="primary-action"
                  type="button"
                  disabled={
                    isSubmitting ||
                    isChecking ||
                    walletBusy ||
                    (!requiresRefresh &&
                      (selectedRows.length === 0 ||
                        (connectedOwnsAccount && !state.canClaim)))
                  }
                  onClick={
                    requiresRefresh
                      ? () => void refreshClaimState()
                      : connectedOwnsAccount
                        ? () => void claim()
                        : () => open({ view: "Connect" })
                  }
                >
                  {isChecking && requiresRefresh
                    ? "[ refreshing stream state… ]"
                    : requiresRefresh
                      ? "[ refresh stream state ]"
                      : isSubmitting
                        ? "[ updating SUP stream… ]"
                        : connectedOwnsAccount
                          ? "[ update SUP stream ]"
                          : "[ connect this wallet to claim ]"}
                </button>
              </footer>
            </>
          ) : populatedRows.length > 0 ? (
            <section className="campaign-list" aria-label="Current campaigns">
              <div className="campaigns">{populatedRows.map(renderCampaign)}</div>
              <p className="empty-state">
                {cappedRows.length > 0
                  ? "No transaction is needed. Capped targets remain visible above."
                  : "No transaction is needed."}
              </p>
            </section>
          ) : (
            <p className="empty-state">
              {resultKind === "no-active-programs"
                ? "No active SUP campaigns."
                : "No campaign allocation was found for this wallet."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
