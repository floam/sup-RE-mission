"use client";

import { lockerAbi } from "@sfpro/sdk/abi/sup";
import { waitForTransactionReceipt } from "@wagmi/core";
import { useAppKit } from "@reown/appkit/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  formatList,
  formatMonthlyFlow,
  getCampaignAttribution,
  shortAddress,
} from "./claim-display";
import type { EventBreakdown } from "./claim-event-breakdown";
import { explainPendingCampaigns } from "./pending-event-explanations";
import {
  chunkItems,
  CMS_BATCH_SIZE,
  getClaimResultKind,
} from "./claim-program-plan";
import {
  isClaimablePointState,
  isPositiveClaimDelta,
} from "./claim-state";

const numberFormat = new Intl.NumberFormat("en-US");

function breakdownKey(account: Address, row: PointState) {
  return `${account}:${row.programId}:${row.onchainPoints}:${row.uncappedPoints}`;
}

export function ClaimExperience() {
  const [account, setAccount] = useState("");
  const [state, setState] = useState<ClaimState>();
  const [message, setMessage] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [selectedPrograms, setSelectedPrograms] = useState<Set<bigint>>(
    () => new Set(),
  );
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [breakdown, setBreakdown] = useState<EventBreakdown>();
  const breakdownCache = useRef(new Map<string, EventBreakdown>());
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

  function clearBreakdown() {
    eventRequest.current += 1;
    breakdownCache.current.clear(), setBreakdown(undefined);
  }

  function applyClaimState(nextState: ClaimState) {
    setState(nextState);
    setSelectedPrograms(
      new Set(
        nextState.programPointStates
          .filter(isPositiveClaimDelta)
          .map((row) => row.programId),
      ),
    );
  }

  function startLookup() {
    checkRequest.current += 1;
    clearBreakdown();
    setAccount("");
    setState(undefined);
    setMessage("");
    setIsLookupOpen(true);
  }

  function updateAccount(nextAccount: string) {
    checkRequest.current += 1;
    clearBreakdown();
    setAccount(nextAccount);
    setState(undefined);
    setMessage("");
  }

  async function reviewAccount(candidate = account) {
    if (!isAddress(candidate)) {
      setMessage("Enter a valid wallet address.");
      return false;
    }

    const reviewedAccount = getAddress(candidate);
    const request = ++checkRequest.current;
    clearBreakdown();
    setAccount(reviewedAccount);
    setState((current) =>
      current?.account === reviewedAccount ? current : undefined,
    );
    setIsChecking(true);
    setMessage("");
    try {
      const nextState = await buildClaimState(config, reviewedAccount);
      if (request !== checkRequest.current) return false;
      applyClaimState(nextState);
      setIsLookupOpen(false);
      return true;
    } catch (error) {
      if (request === checkRequest.current) {
        setMessage(error instanceof Error ? error.message : String(error));
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

  async function claim() {
    if (
      isSubmitting ||
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
    let confirmedBatches = 0;
    setIsSubmitting(true);
    clearBreakdown();

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
        const receipt = await waitForTransactionReceipt(config, {
          chainId: base.id,
          hash,
        });
        if (receipt.status !== "success") {
          throw new Error(`Transaction ${index + 1} reverted.`);
        }
        confirmedBatches += 1;
      }

      const refreshed = await buildClaimState(config, state.account);
      if (request !== checkRequest.current) return;
      applyClaimState(refreshed);
      setMessage("");
    } catch (error) {
      if (request !== checkRequest.current) return;
      if (confirmedBatches > 0) {
        try {
          const refreshed = await buildClaimState(config, state.account);
          if (request === checkRequest.current) applyClaimState(refreshed);
        } catch {
          // Preserve the transaction error when a follow-up refresh also fails.
        }
      }
      if (request === checkRequest.current) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (request === checkRequest.current) setIsSubmitting(false);
    }
  }

  async function toggleBreakdown(row: PointState) {
    if (
      !state ||
      !row.cmsCampaignExists ||
      !row.isOnchainOutdated ||
      row.isCapped
    ) {
      return;
    }
    const selection = { account: state.account, programId: row.programId };
    if (
      breakdown?.selection.account === selection.account &&
      breakdown.selection.programId === selection.programId
    ) {
      clearBreakdown();
      return;
    }

    const selectedKey = breakdownKey(state.account, row);
    const cached = breakdownCache.current.get(selectedKey);
    if (cached) {
      setBreakdown(cached);
      return;
    }

    const request = ++eventRequest.current;
    setBreakdown({
      selection,
      events: [],
      message: "Finding the newest events that explain this point difference…",
    });

    try {
      const explanatoryRows = state.programPointStates.filter(
        (candidate) =>
          candidate.cmsCampaignExists &&
          candidate.isOnchainOutdated &&
          !candidate.isCapped,
      );
      const explanations = await explainPendingCampaigns(
        config,
        state.account,
        explanatoryRows,
      );
      if (request !== eventRequest.current) return;

      const rowsByProgram = new Map(
        explanatoryRows.map((candidate) => [candidate.programId, candidate]),
      );
      for (const explanation of explanations) {
        const candidate = rowsByProgram.get(explanation.selection.programId);
        if (!candidate) continue;
        breakdownCache.current.set(
          breakdownKey(state.account, candidate),
          explanation,
        );
      }

      const selected = breakdownCache.current.get(selectedKey);
      if (!selected) {
        throw new Error("The event explanation omitted this campaign.");
      }
      setBreakdown(selected);
    } catch (error) {
      if (request !== eventRequest.current) return;
      setBreakdown({
        selection,
        events: [],
        message: error instanceof Error ? error.message : String(error),
      });
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
  const visibleRows = showCurrent
    ? populatedRows
    : populatedRows.filter((row) => row.isCapped || isClaimablePointState(row));
  const totalUnitDelta = selectedRows.reduce(
    (sum, row) => sum + row.offchainPoints - row.onchainPoints,
    0n,
  );
  const totalFlowDelta = selectedRows.reduce(
    (sum, row) => sum + row.projectedFlowRate - row.currentFlowRate,
    0n,
  );
  const campaignNames = [
    ...new Set(
      selectedRows.flatMap((row) => getCampaignAttribution(row.programId).names),
    ),
  ];
  const campaignScope = campaignNames.length
    ? ` across ${formatList(campaignNames)}`
    : "";
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

  let heroTitle = "Claim your share of Superfluid.";
  let heroDescription: ReactNode =
    "Check what you've earned across active campaigns, then update your SUP stream with a single wallet transaction.";
  if (isChecking) {
    heroTitle = "Checking your SUP rewards…";
  } else if (stateMatchesAccount && state) {
    if (resultKind === "locker-required") {
      heroTitle = "Create your Reserve to claim SUP.";
      heroDescription =
        "SUP rewards stream into a Superfluid Reserve. Create yours, then return here to claim.";
    } else if (resultKind === "no-active-programs") {
      heroTitle = "No active SUP campaigns.";
      heroDescription =
        "Your existing Reserve allocations are unchanged. Check again when a new campaign starts.";
    } else if (resultKind === "updates-found") {
      heroTitle =
        totalFlowDelta > 0n
          ? "Your SUP stream can grow."
          : "Your campaign rewards changed.";
      heroDescription = (
        <>
          You selected {selectedRows.length} of {changedRows.length} campaign update
          {changedRows.length === 1 ? "" : "s"}, which would change your stream by{" "}
          <strong>{formatMonthlyFlow(totalFlowDelta, true)}</strong>
          {campaignScope}.
        </>
      );
    } else {
      heroTitle = "Your SUP stream is up to date.";
      heroDescription = cappedRows.length
        ? `No transaction is needed. ${cappedRows.length} campaign${cappedRows.length === 1 ? " has" : "s have"} reached the maximum allocation.`
        : `We checked ${state.programPointStates.length} active campaign${state.programPointStates.length === 1 ? "" : "s"}. No transaction is needed.`;
    }
  }

  function renderCampaign(row: PointState) {
    const rowBreakdown =
      breakdown?.selection.account === state?.account &&
      breakdown.selection.programId === row.programId
        ? breakdown
        : undefined;
    return (
      <ClaimCampaignChange
        key={String(row.programId)}
        row={row}
        isSelected={
          isClaimablePointState(row)
            ? selectedPrograms.has(row.programId)
            : undefined
        }
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
        breakdown={rowBreakdown}
        onToggleBreakdown={toggleBreakdown}
      />
    );
  }

  const showLookup = !stateMatchesAccount && (!isConnected || isLookupOpen);
  const showWorkbench =
    showLookup ||
    Boolean(message) ||
    (stateMatchesAccount && state !== undefined);

  return (
    <>
      <header className="hero" aria-live="polite">
        <h1>{heroTitle}</h1>
        <p>{heroDescription}</p>
      </header>

      {showWorkbench && (
        <section className="claim-workbench">
          {showLookup && (
            <div className="wallet-step">
              {!isLookupOpen ? (
                <div className="wallet-actions">
                  <button
                    className="primary-action"
                    type="button"
                    disabled={walletBusy}
                    onClick={() => open({ view: "Connect" })}
                  >
                    {walletBusy ? "Connecting…" : "Connect wallet"}
                  </button>
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={startLookup}
                  >
                    Look up another wallet
                  </button>
                </div>
              ) : (
                <>
                  <label className="account-field">
                    <span>Wallet address</span>
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
                      disabled={
                        isChecking || isSubmitting || !isAddress(account)
                      }
                      onClick={() => void reviewAccount()}
                    >
                      {isChecking ? "Checking…" : "Check eligibility"}
                    </button>
                    <button
                      className="secondary-action"
                      type="button"
                      disabled={isChecking || isSubmitting}
                      onClick={cancelLookup}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {message && (
            <div className="status claim-status" role="status">
              <span>{message}</span>
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
                    Retry
                  </button>
                )}
            </div>
          )}

          {stateMatchesAccount && state && (
            <div className="results" aria-live="polite">
              <div className="wallet-actions">
                <button
                  className="secondary-action"
                  type="button"
                  disabled={isSubmitting}
                  onClick={startLookup}
                >
                  Check another wallet
                </button>
              </div>

              {resultKind === "locker-required" ? (
                <div className="submit-update">
                  <div>
                    <strong>
                      A Reserve is required before rewards can stream.
                    </strong>
                    <span>Create it once, then return to this claim.</span>
                  </div>
                  {connectedOwnsAccount ? (
                    <button
                      className="primary-action"
                      type="button"
                      onClick={() => router.push("/reserve")}
                    >
                      Create Reserve
                    </button>
                  ) : (
                    <button
                      className="primary-action"
                      type="button"
                      onClick={() => open({ view: "Connect" })}
                    >
                      Connect this wallet
                    </button>
                  )}
                </div>
              ) : resultKind === "updates-found" ? (
                <>
                  <div className="impact-summary" aria-label="Claim summary">
                    <div>
                      <span>Campaigns to update</span>
                      <strong>{selectedRows.length}</strong>
                    </div>
                    <div>
                      <span>Stream change</span>
                      <strong
                        className={
                          totalFlowDelta < 0n ? "negative" : "positive"
                        }
                      >
                        {formatMonthlyFlow(totalFlowDelta, true)}
                      </strong>
                    </div>
                    <div>
                      <span>Transactions</span>
                      <strong>{transactionCount}</strong>
                    </div>
                  </div>

                  <section className="campaign-list">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">Campaign rewards</span>
                        <h3>What changed</h3>
                      </div>
                      <label className="toggle-current">
                        <input
                          type="checkbox"
                          checked={showCurrent}
                          onChange={(event) =>
                            setShowCurrent(event.target.checked)
                          }
                        />
                        <span>Show all campaign details</span>
                      </label>
                    </div>
                    <div className="campaigns">
                      {visibleRows.map(renderCampaign)}
                    </div>
                  </section>

                  <footer className="submit-update">
                    <div>
                      <strong>
                        {selectedRows.length} campaign update
                        {selectedRows.length === 1 ? "" : "s"} selected
                      </strong>
                      <span>
                        {selectedRows.length === 0
                          ? "Select at least one campaign to update. Decreasing campaigns are clear by default."
                          : transactionCount === 1
                          ? `One wallet transaction applies ${numberFormat.format(totalUnitDelta)} units and updates every stream shown above.`
                          : `${transactionCount} wallet transactions are needed because the points API signs at most ${CMS_BATCH_SIZE} campaigns at a time.`}
                      </span>
                    </div>
                    <button
                      className="primary-action"
                      type="button"
                      disabled={
                        isSubmitting ||
                        walletBusy ||
                        selectedRows.length === 0 ||
                        (connectedOwnsAccount && !state.canClaim)
                      }
                      onClick={
                        connectedOwnsAccount
                          ? () => void claim()
                          : () => open({ view: "Connect" })
                      }
                    >
                      {isSubmitting
                        ? "Updating stream…"
                        : connectedOwnsAccount
                          ? "Update SUP stream"
                          : "Connect this wallet to claim"}
                    </button>
                  </footer>
                </>
              ) : populatedRows.length > 0 ? (
                <section className="campaign-list">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">Campaign rewards</span>
                      <h3>Current streams</h3>
                    </div>
                    <label className="toggle-current">
                      <input
                        type="checkbox"
                        checked={showCurrent}
                        onChange={(event) =>
                          setShowCurrent(event.target.checked)
                        }
                      />
                      <span>Show all campaign details</span>
                    </label>
                  </div>
                  {(showCurrent || cappedRows.length > 0) && (
                    <div className="campaigns">
                      {(showCurrent ? populatedRows : cappedRows).map(
                        renderCampaign,
                      )}
                    </div>
                  )}
                </section>
              ) : null}

              <details className="account-details">
                <summary>Wallet and protocol details</summary>
                <dl>
                  <div>
                    <dt>Wallet</dt>
                    <dd>{shortAddress(state.account)}</dd>
                  </div>
                  <div>
                    <dt>Reserve</dt>
                    <dd>{shortAddress(state.lockerAddress)}</dd>
                  </div>
                </dl>
              </details>
            </div>
          )}
        </section>
      )}
    </>
  );
}
