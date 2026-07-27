"use client";

import { useAppKit } from "@reown/appkit/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  parseAbi,
  type Address,
} from "viem";
import { base } from "viem/chains";
import { useSwitchChain, useWriteContract } from "wagmi";

import { ALCHEMY_RPC_URLS } from "../config/rpc";
import { FLUID_LOCKER_FACTORY_ADDRESS } from "../contracts/app-contracts";
import { PROGRAM_APP_DEFINITIONS } from "../data/program-app-definitions";
import { useWalletAccount } from "../hooks/useWalletAccount";
import { isClaimablePointState } from "./claim-state";
import { getProgramStatus, getPublicPrograms } from "./programs";

const CMS_BASE = "https://cms.superfluid.pro";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const CMS_BATCH_SIZE = 50;
const publicClient = createPublicClient({
  chain: base,
  transport: http(ALCHEMY_RPC_URLS[8453]),
});
const factoryAbi = parseAbi([
  "function getUserLocker(address user) view returns (bool isCreated, address lockerAddress)",
]);
const batchClaimAbi = parseAbi([
  "function claim(uint256[] programIds, uint256[] totalProgramUnits, uint256 nonce, bytes stackSignature)",
]);
const poolUnitsAbi = parseAbi([
  "function getUnits(address member) view returns (uint128)",
]);

interface PointState {
  programId: bigint;
  offchainPoints: bigint;
  onchainPoints: bigint;
  isOnchainOutdated: boolean;
  cmsCampaignExists: boolean;
}

interface State {
  account: Address;
  lockerAddress: Address;
  lockerCreated: boolean;
  canClaim: boolean;
  programPointStates: PointState[];
}

interface CmsBalanceResponse {
  campaignIds: number[];
  points: number[];
  cappedPoints?: number[];
  warnings?: Array<{ campaignId: number; message: string }>;
}

interface CmsSignedBalanceResponse {
  campaignIds: number[];
  points: number[];
  signatureTimestamp: number;
  signature: `0x${string}`;
}

interface CmsEvent {
  id: number;
  eventName: string;
  points: number;
  createdAt: string;
}

interface EventSelection {
  account: Address;
  programId: bigint;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json() as Promise<T>;
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

async function buildPointState(account: Address): Promise<State> {
  const programs = (await getPublicPrograms()).filter(
    (program) => getProgramStatus(program) === "Active",
  );
  const programIds = programs.map((program) => Number(program.id));
  const [lockerCreated, lockerAddress] = await publicClient.readContract({
    authorizationList: undefined,
    address: FLUID_LOCKER_FACTORY_ADDRESS[8453],
    abi: factoryAbi,
    functionName: "getUserLocker",
    args: [account],
  });

  const balances = await Promise.all(
    chunks(programIds, CMS_BATCH_SIZE).map((campaignIds) =>
      postJson<CmsBalanceResponse>(`${CMS_BASE}/points/balance-batch`, {
        account,
        campaignIds,
      }),
    ),
  );
  const cappedByProgram = new Map<number, bigint>();
  const cmsMissingPrograms = new Set<number>();
  for (const balance of balances) {
    const targets = balance.cappedPoints ?? balance.points;
    balance.campaignIds.forEach((id, index) =>
      cappedByProgram.set(id, BigInt(targets[index] ?? 0)),
    );
    for (const warning of balance.warnings ?? []) {
      if (warning.message === "Campaign not found") {
        cmsMissingPrograms.add(warning.campaignId);
      }
    }
  }

  const onchainByProgram = new Map<number, bigint>();
  if (lockerAddress !== ZERO_ADDRESS) {
    const unitReads = await publicClient.multicall({
      authorizationList: undefined,
      allowFailure: true,
      contracts: programs.map((program) => ({
        address: getAddress(program.distributionPool),
        abi: poolUnitsAbi,
        functionName: "getUnits",
        args: [lockerAddress],
      })),
    });
    unitReads.forEach((read, index) => {
      if (read.status === "success") {
        onchainByProgram.set(Number(programs[index].id), read.result);
      }
    });
    const failedReads = unitReads.filter((read) => read.status === "failure");
    if (failedReads.length > 0) {
      throw new Error(
        `Unable to read ${failedReads.length} campaign pool${failedReads.length === 1 ? "" : "s"}`,
      );
    }
  }

  const programPointStates = programs.map((program) => {
    const programId = Number(program.id);
    const offchainPoints = cappedByProgram.get(programId) ?? 0n;
    const onchainPoints = onchainByProgram.get(programId) ?? 0n;
    return {
      programId: BigInt(programId),
      offchainPoints,
      onchainPoints,
      isOnchainOutdated: offchainPoints !== onchainPoints,
      cmsCampaignExists: !cmsMissingPrograms.has(programId),
    };
  });

  return {
    account,
    lockerAddress: getAddress(lockerAddress),
    lockerCreated,
    canClaim:
      lockerCreated &&
      lockerAddress !== ZERO_ADDRESS &&
      programPointStates.some(isClaimablePointState),
    programPointStates,
  };
}

function formatUnits(value: bigint) {
  return new Intl.NumberFormat("en-US").format(value);
}

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatList(values: string[]) {
  return new Intl.ListFormat("en-US", {
    style: "long",
    type: "conjunction",
  }).format(values);
}

function getCampaignAttribution(programId: bigint) {
  const definitions = PROGRAM_APP_DEFINITIONS.filter(
    (app) => app.program?.id === Number(programId),
  );
  return {
    names: [...new Set(definitions.map((app) => app.name))],
    descriptors: [
      ...new Set(
        definitions.map(
          (app) => `Season ${app.season ?? "—"} · ${app.category}`,
        ),
      ),
    ],
  };
}

function CampaignChange({
  row,
  eventsOpen,
  onToggleEvents,
}: {
  row: PointState;
  eventsOpen: boolean;
  onToggleEvents(row: PointState): void;
}) {
  const attribution = getCampaignAttribution(row.programId);
  const delta = row.offchainPoints - row.onchainPoints;
  const maximum =
    row.offchainPoints > row.onchainPoints
      ? row.offchainPoints
      : row.onchainPoints;
  const currentWidth =
    maximum === 0n ? 0 : Number((row.onchainPoints * 100n) / maximum);
  const targetWidth =
    maximum === 0n ? 0 : Number((row.offchainPoints * 100n) / maximum);

  return (
    <article className="campaign-change">
      <header className="campaign-heading">
        <div>
          <h4>
            {attribution.names.length
              ? formatList(attribution.names)
              : `Campaign ${row.programId}`}
          </h4>
          <p className="campaign-meta">
            {attribution.descriptors.length
              ? `${attribution.descriptors.join(" / ")} · #${row.programId}`
              : `Campaign #${row.programId}`}
          </p>
        </div>
        <span
          className={
            !row.cmsCampaignExists
              ? "unavailable-pill"
              : row.isOnchainOutdated
                ? "update-pill"
                : "current-pill"
          }
        >
          {!row.cmsCampaignExists
            ? "CMS unavailable"
            : row.isOnchainOutdated
              ? "Update available"
              : "Synchronized"}
        </span>
      </header>
      <div className="unit-comparison">
        <div className="unit-row">
          <span>Current</span>
          <div className="unit-track" aria-hidden="true">
            <span style={{ width: `${currentWidth}%` }} />
          </div>
          <strong>{formatUnits(row.onchainPoints)}</strong>
        </div>
        <div className="unit-row target">
          <span>Target</span>
          <div className="unit-track" aria-hidden="true">
            <span style={{ width: `${targetWidth}%` }} />
          </div>
          <strong>{formatUnits(row.offchainPoints)}</strong>
        </div>
      </div>
      <div className="campaign-outcome">
        <span>{delta >= 0n ? "You'll gain" : "Allocation adjustment"}</span>
        <strong className={delta >= 0n ? "positive" : "negative"}>
          {delta > 0n ? "+" : ""}
          {formatUnits(delta)} units
        </strong>
      </div>
      <div className="campaign-actions">
        <details className="technical-details">
          <summary>Technical details</summary>
          <p>
            Campaign #{row.programId}. Current locker pool units are compared
            with the signed CMS allocation target.
          </p>
        </details>
        <button
          className="text-button"
          type="button"
          disabled={!row.cmsCampaignExists}
          onClick={() => onToggleEvents(row)}
        >
          {eventsOpen ? "Hide recent events" : "Recent events"}
        </button>
      </div>
    </article>
  );
}

export function ClaimPanel() {
  const [account, setAccount] = useState("");
  const [state, setState] = useState<State>();
  const [message, setMessage] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [eventSelection, setEventSelection] = useState<EventSelection>();
  const [events, setEvents] = useState<CmsEvent[]>([]);
  const [eventsMessage, setEventsMessage] = useState("");
  const checkRequest = useRef(0);
  const eventRequest = useRef(0);
  const { open } = useAppKit();
  const {
    address: connectedAddress,
    chainId,
    isConnected,
    isConnecting,
    isReconnecting,
  } = useWalletAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  useEffect(() => {
    if (connectedAddress && !account) setAccount(getAddress(connectedAddress));
  }, [account, connectedAddress]);

  function clearEvents() {
    eventRequest.current += 1;
    setEventSelection(undefined);
    setEvents([]);
    setEventsMessage("");
  }

  function updateAccount(nextAccount: string) {
    checkRequest.current += 1;
    clearEvents();
    setAccount(nextAccount);
    setState(undefined);
    setMessage("");
  }

  async function check() {
    if (!isAddress(account)) return setMessage("Enter a valid EVM address.");
    const checkedAccount = getAddress(account);
    const request = ++checkRequest.current;
    clearEvents();
    setState(undefined);
    setIsChecking(true);
    setMessage("Checking the latest campaign allocations…");
    try {
      const nextState = await buildPointState(checkedAccount);
      if (request !== checkRequest.current) return;
      setState(nextState);
      setMessage("");
    } catch (error) {
      if (request !== checkRequest.current) return;
      setMessage(String(error));
    } finally {
      if (request === checkRequest.current) setIsChecking(false);
    }
  }

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
    )
      return;

    const selected = state.programPointStates.filter(isClaimablePointState);
    const selections = chunks(selected, CMS_BATCH_SIZE);
    const request = ++checkRequest.current;
    setIsSubmitting(true);
    clearEvents();

    try {
      if (chainId !== base.id) await switchChainAsync({ chainId: base.id });
      for (const [index, selection] of selections.entries()) {
        setMessage(
          `Preparing transaction ${index + 1} of ${selections.length}…`,
        );
        const signed = await postJson<CmsSignedBalanceResponse>(
          `${CMS_BASE}/points/signed-balance-batch`,
          {
            account: state.account,
            campaignIds: selection.map((row) => Number(row.programId)),
          },
        );
        const hash = await writeContractAsync({
          account: state.account,
          address: state.lockerAddress,
          abi: batchClaimAbi,
          functionName: "claim",
          args: [
            signed.campaignIds.map(BigInt),
            signed.points.map(BigInt),
            BigInt(signed.signatureTimestamp),
            signed.signature,
          ],
          chainId: base.id,
        });
        setMessage(
          `Transaction ${index + 1} of ${selections.length} submitted: ${hash}`,
        );
        await publicClient.waitForTransactionReceipt({ hash });
      }

      const refreshed = await buildPointState(state.account);
      if (request !== checkRequest.current) return;
      setState(refreshed);
      setMessage("Campaign allocations synchronized and refreshed.");
    } catch (error) {
      if (request !== checkRequest.current) return;
      setMessage(String(error));
    } finally {
      if (request === checkRequest.current) setIsSubmitting(false);
    }
  }

  async function toggleEvents(row: PointState) {
    if (!state || !row.cmsCampaignExists) return;
    const selection = { account: state.account, programId: row.programId };
    if (
      eventSelection?.account === selection.account &&
      eventSelection.programId === selection.programId
    ) {
      clearEvents();
      return;
    }

    const request = ++eventRequest.current;
    setEventSelection(selection);
    setEvents([]);
    setEventsMessage("Loading recent point events…");
    try {
      const params = new URLSearchParams({
        campaignId: String(selection.programId),
        account: selection.account,
        limit: "8",
        page: "1",
      });
      const response = await fetch(`${CMS_BASE}/points/events?${params}`);
      if (!response.ok)
        throw new Error(`CMS events returned ${response.status}`);
      const result = (await response.json()) as { events?: CmsEvent[] };
      if (request !== eventRequest.current) return;
      setEvents(result.events ?? []);
      setEventsMessage(result.events?.length ? "" : "No recent events found.");
    } catch (error) {
      if (request !== eventRequest.current) return;
      setEventsMessage(String(error));
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
        (row) => row.offchainPoints > 0n || row.onchainPoints > 0n,
      )
    : [];
  const changedRows = populatedRows.filter(isClaimablePointState);
  const visibleRows = showCurrent ? populatedRows : changedRows;
  const totalDelta = useMemo(
    () =>
      changedRows.reduce(
        (sum, row) => sum + row.offchainPoints - row.onchainPoints,
        0n,
      ),
    [changedRows],
  );
  const campaignNames = [
    ...new Set(
      changedRows.flatMap((row) => getCampaignAttribution(row.programId).names),
    ),
  ];
  const campaignScope = campaignNames.length
    ? ` across ${formatList(campaignNames)}`
    : "";
  const transactionCount = Math.ceil(changedRows.length / CMS_BATCH_SIZE);
  const walletBusy = isConnecting || isReconnecting;

  return (
    <section className="claim-workbench">
      <div className="wallet-step">
        <span className="eyebrow">Wallet</span>
        <h2>Check for campaign updates</h2>
        <p className="muted">
          Inspect any address, then connect that same wallet to synchronize its
          current onchain units with the latest campaign allocations.
        </p>
        <label className="account-field">
          <span>Wallet address</span>
          <input
            value={account}
            disabled={isSubmitting}
            onChange={(event) => updateAccount(event.target.value)}
            placeholder="0x…"
            inputMode="text"
          />
        </label>
        <div className="wallet-actions">
          {!isConnected ? (
            <button
              className="secondary-action"
              type="button"
              disabled={walletBusy}
              onClick={() => open({ view: "Connect" })}
            >
              {walletBusy ? "Connecting…" : "Connect wallet"}
            </button>
          ) : connectedAddress &&
            (!isAddress(account) ||
              getAddress(account) !== getAddress(connectedAddress)) ? (
            <button
              className="secondary-action"
              type="button"
              disabled={isSubmitting}
              onClick={() => updateAccount(getAddress(connectedAddress))}
            >
              Use connected wallet
            </button>
          ) : null}
          <button
            className="primary-action"
            type="button"
            disabled={isChecking || isSubmitting || !isAddress(account)}
            onClick={check}
          >
            {isChecking ? "Checking…" : "Check for updates"}
          </button>
        </div>
        {message && (
          <p className="status" role="status">
            {message}
          </p>
        )}
      </div>

      {stateMatchesAccount && state && (
        <div className="results" aria-live="polite">
          {!state.lockerCreated || state.lockerAddress === ZERO_ADDRESS ? (
            <div className="result-callout">
              <span className="eyebrow">Action needed</span>
              <h3>
                Create a locker before synchronizing campaign allocations.
              </h3>
            </div>
          ) : changedRows.length > 0 ? (
            <div className="result-callout success">
              <span className="eyebrow">Updates found</span>
              <h3>
                Your wallet has {changedRows.length} campaign
                {changedRows.length === 1 ? "" : "s"} that need
                {changedRows.length === 1 ? "s" : ""} updating.
              </h3>
              <p>
                Updating will {totalDelta >= 0n ? "increase" : "adjust"} your
                allocation{campaignScope} by <strong>{totalDelta > 0n ? "+" : ""}{formatUnits(totalDelta)} units</strong>. This requires {transactionCount === 1 ? "one transaction" : `${transactionCount} transactions`} and does not move your funds.
              </p>
            </div>
          ) : (
            <div className="result-callout success">
              <span className="eyebrow">All synchronized</span>
              <h3>Your campaign allocations are up to date.</h3>
              <p>No transaction is needed.</p>
            </div>
          )}

          <div className="impact-summary" aria-label="Update summary">
            <div>
              <span>Campaigns changing</span>
              <strong>{changedRows.length}</strong>
            </div>
            <div>
              <span>Allocation change</span>
              <strong className={totalDelta < 0n ? "negative" : "positive"}>
                {totalDelta > 0n ? "+" : ""}
                {formatUnits(totalDelta)} units
              </strong>
            </div>
            <div>
              <span>Transactions</span>
              <strong>{transactionCount}</strong>
            </div>
          </div>

          {populatedRows.length > 0 && (
            <section className="campaign-list">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Campaign changes</span>
                  <h3>Your allocation details</h3>
                  <p className="muted">
                    Review what is onchain now, the latest campaign target, and
                    the recent CMS events supporting it.
                  </p>
                </div>
                <label className="toggle-current">
                  <input
                    type="checkbox"
                    checked={showCurrent}
                    onChange={(event) => setShowCurrent(event.target.checked)}
                  />
                  <span>Show campaigns with no updates</span>
                </label>
              </div>
              <div className="campaigns">
                {visibleRows.map((row) => (
                  <CampaignChange
                    key={String(row.programId)}
                    row={row}
                    eventsOpen={
                      eventSelection?.account === state.account &&
                      eventSelection.programId === row.programId
                    }
                    onToggleEvents={toggleEvents}
                  />
                ))}
              </div>
            </section>
          )}

          {eventSelection?.account === state.account && (
            <section className="event-drawer">
              <div className="event-heading">
                <div>
                  <span className="eyebrow">CMS evidence</span>
                  <h3>
                    Recent point events · Campaign {String(eventSelection.programId)}
                  </h3>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={clearEvents}
                >
                  Close
                </button>
              </div>
              {eventsMessage && <p className="muted">{eventsMessage}</p>}
              {events.length > 0 && (
                <div className="event-list">
                  {events.map((event) => (
                    <div className="event-row" key={event.id}>
                      <span>
                        <strong>{event.eventName}</strong>
                        <small>
                          {new Date(event.createdAt).toLocaleString()}
                        </small>
                      </span>
                      <strong
                        className={event.points < 0 ? "negative" : "positive"}
                      >
                        {event.points >= 0 ? "+" : ""}
                        {event.points}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {changedRows.length > 0 && (
            <footer className="submit-update">
              <div>
                <strong>
                  {changedRows.length} campaign update
                  {changedRows.length === 1 ? "" : "s"} ready
                </strong>
                <span>
                  {transactionCount === 1
                    ? "One wallet transaction synchronizes every update shown above."
                    : `${transactionCount} wallet transactions are required because the CMS signs at most ${CMS_BATCH_SIZE} campaigns per batch.`}
                </span>
              </div>
              <button
                className="primary-action"
                disabled={
                  isSubmitting ||
                  !state.canClaim ||
                  !connectedOwnsAccount ||
                  walletBusy
                }
                onClick={claim}
              >
                {isSubmitting
                  ? "Synchronizing…"
                  : connectedOwnsAccount
                    ? "Synchronize campaign allocations"
                    : "Connect this wallet to synchronize"}
              </button>
            </footer>
          )}

          <details className="account-details">
            <summary>Account and protocol details</summary>
            <dl>
              <div>
                <dt>Account</dt>
                <dd>{shortAddress(state.account)}</dd>
              </div>
              <div>
                <dt>Locker</dt>
                <dd>{shortAddress(state.lockerAddress)}</dd>
              </div>
            </dl>
          </details>
        </div>
      )}
    </section>
  );
}
