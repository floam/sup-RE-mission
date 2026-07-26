"use client";

import { useMemo, useRef, useState } from "react";
import {
  createPublicClient,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  parseAbi,
  type Address,
} from "viem";
import { base } from "viem/chains";

import { ALCHEMY_RPC_URLS } from "../config/rpc";
import { FLUID_LOCKER_FACTORY_ADDRESS } from "../contracts/app-contracts";
import { PROGRAM_APP_DEFINITIONS } from "../data/program-app-definitions";
import { isClaimablePointState } from "./claim-state";
import { getProgramStatus, SUP_SUBGRAPH } from "./programs";

const CMS_BASE = "https://cms.superfluid.pro";
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
  name: string;
  season?: string;
  category: string;
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

function formatUnits(value: bigint) {
  return new Intl.NumberFormat().format(value);
}

function formatDelta(value: bigint) {
  return `${value >= 0n ? "+" : "−"}${formatUnits(value < 0n ? -value : value)}`;
}

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
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

async function queryGraph<T>(
  url: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await postJson<{ data?: T; errors?: unknown }>(url, {
    query,
    variables,
  });
  if (!response.data)
    throw new Error(
      `Subgraph query failed: ${JSON.stringify(response.errors)}`,
    );
  return response.data;
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

async function buildPointState(account: Address): Promise<State> {
  const programIds = [
    ...new Set(
      PROGRAM_APP_DEFINITIONS.flatMap((app) =>
        app.program ? [app.program.id] : [],
      ),
    ),
  ];
  const [lockerCreated, lockerAddress] = await publicClient.readContract({
    authorizationList: undefined,
    address: FLUID_LOCKER_FACTORY_ADDRESS[8453],
    abi: factoryAbi,
    functionName: "getUserLocker",
    args: [account],
  });
  const balances = await Promise.all(
    chunks(programIds, 50).map((campaignIds) =>
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
  const { programs: allPrograms } = await queryGraph<{
    programs: Array<{
      id: string;
      distributionPool: string;
      stoppedDate: string;
      endDate: string;
    }>;
  }>(
    SUP_SUBGRAPH,
    `query ClaimPools($ids: [String!]!) {
      programs(first: 1000, where: { id_in: $ids }) {
        id
        distributionPool
        stoppedDate
        endDate
      }
    }`,
    { ids: programIds.map(String) },
  );
  const programs = allPrograms.filter(
    (program) => getProgramStatus(program) === "Active",
  );
  const onchainByProgram = new Map<number, bigint>();
  if (lockerAddress !== "0x0000000000000000000000000000000000000000") {
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
        `Unable to read ${failedReads.length} program pool${failedReads.length === 1 ? "" : "s"}`,
      );
    }
  }
  const activeProgramIds = programs.map((program) => Number(program.id));
  const programPointStates = activeProgramIds.map((programId) => {
    const app = PROGRAM_APP_DEFINITIONS.find(
      (definition) => definition.program?.id === programId,
    );
    const offchainPoints = cappedByProgram.get(programId) ?? 0n;
    const onchainPoints = onchainByProgram.get(programId) ?? 0n;
    return {
      programId: BigInt(programId),
      name: app?.name ?? `Program ${programId}`,
      season: app?.season,
      category: app?.category ?? "Unattributed",
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
      lockerAddress !== "0x0000000000000000000000000000000000000000" &&
      programPointStates.some(isClaimablePointState),
    programPointStates,
  };
}

interface WalletProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

function getWalletProvider() {
  return window.ethereum as unknown as WalletProvider | undefined;
}

export function ClaimPanel() {
  const [account, setAccount] = useState("");
  const [state, setState] = useState<State>();
  const [message, setMessage] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [eventProgram, setEventProgram] = useState<bigint>();
  const [events, setEvents] = useState<CmsEvent[]>([]);
  const [eventsMessage, setEventsMessage] = useState("");
  const checkRequest = useRef(0);

  function updateAccount(nextAccount: string) {
    checkRequest.current += 1;
    setAccount(nextAccount);
    setState(undefined);
    setMessage("");
  }

  async function connect() {
    const provider = getWalletProvider();
    if (!provider) throw new Error("No injected wallet found");
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
    })) as string[];
    updateAccount(accounts[0] ?? "");
  }

  async function check() {
    if (!isAddress(account)) return setMessage("Enter a valid EVM address.");
    const checkedAccount = getAddress(account);
    const request = ++checkRequest.current;
    setState(undefined);
    setMessage("Loading CMS targets and onchain units…");
    try {
      const nextState = await buildPointState(checkedAccount);
      if (request !== checkRequest.current) return;
      setState(nextState);
      setMessage(
        !nextState.lockerCreated ||
          nextState.lockerAddress ===
            "0x0000000000000000000000000000000000000000"
          ? "Create a locker before claiming points."
          : nextState.canClaim
            ? "Updates are ready to claim."
            : "Your onchain units are current.",
      );
    } catch (error) {
      if (request !== checkRequest.current) return;
      setMessage(String(error));
    }
  }

  async function claim() {
    const provider = getWalletProvider();
    if (
      !state?.canClaim ||
      !state.lockerCreated ||
      state.lockerAddress === "0x0000000000000000000000000000000000000000" ||
      !isAddress(account) ||
      getAddress(account) !== state.account ||
      !provider
    )
      return;
    const selected = state.programPointStates.filter(isClaimablePointState);
    setMessage("Requesting a signed CMS balance…");
    try {
      const signed = await postJson<CmsSignedBalanceResponse>(
        `${CMS_BASE}/points/signed-balance-batch`,
        {
          account,
          campaignIds: selected.map((row) => Number(row.programId)),
        },
      );
      const data = encodeFunctionData({
        abi: batchClaimAbi,
        functionName: "claim",
        args: [
          signed.campaignIds.map(BigInt),
          signed.points.map(BigInt),
          BigInt(signed.signatureTimestamp),
          signed.signature,
        ],
      });
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });
      } catch (error) {
        if ((error as { code?: number }).code !== 4902) throw error;
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x2105",
              chainName: "Base",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: [ALCHEMY_RPC_URLS[8453]],
              blockExplorerUrls: ["https://basescan.org"],
            },
          ],
        });
      }
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: account, to: state.lockerAddress, data }],
      });
      setMessage(`Transaction submitted: ${String(hash)}`);
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function toggleEvents(row: PointState) {
    if (eventProgram === row.programId) {
      setEventProgram(undefined);
      return;
    }
    setEventProgram(row.programId);
    setEvents([]);
    setEventsMessage("Loading recent point events…");
    try {
      const params = new URLSearchParams({
        campaignId: String(row.programId),
        account: state?.account ?? account,
        limit: "8",
        page: "1",
      });
      const response = await fetch(`${CMS_BASE}/points/events?${params}`);
      if (!response.ok)
        throw new Error(`CMS events returned ${response.status}`);
      const result = (await response.json()) as { events?: CmsEvent[] };
      setEvents(result.events ?? []);
      setEventsMessage(result.events?.length ? "" : "No recent events found.");
    } catch (error) {
      setEventsMessage(String(error));
    }
  }

  const stateMatchesAccount =
    state !== undefined &&
    isAddress(account) &&
    getAddress(account) === state.account;
  const relevantRows = useMemo(
    () =>
      stateMatchesAccount
        ? state.programPointStates
            .filter(
              (row) =>
                row.isOnchainOutdated ||
                (showCurrent &&
                  (row.offchainPoints > 0n || row.onchainPoints > 0n)),
            )
            .sort(
              (a, b) =>
                Number(b.isOnchainOutdated) - Number(a.isOnchainOutdated),
            )
        : undefined,
    [showCurrent, stateMatchesAccount, state],
  );
  const updateRows = stateMatchesAccount
    ? state.programPointStates.filter(isClaimablePointState)
    : [];
  const netDelta = updateRows.reduce(
    (total, row) => total + row.offchainPoints - row.onchainPoints,
    0n,
  );
  return (
    <section className="claim-workbench">
      <div className="account-bar">
        <div>
          <span className="eyebrow">Pool unit workbench</span>
          <h2>Inspect an account</h2>
        </div>
        <div className="account-controls">
          <input
            value={account}
            onChange={(event) => updateAccount(event.target.value)}
            placeholder="0x…"
          />
          <button
            onClick={() =>
              connect().catch((error) => setMessage(String(error)))
            }
          >
            Connect
          </button>
          <button onClick={check}>Check</button>
        </div>
      </div>
      {message && <p className="status">{message}</p>}
      {relevantRows && (
        <>
          <div className="claim-summary">
            <div>
              <span>Account</span>
              <strong>{shortAddress(state!.account)}</strong>
            </div>
            <div>
              <span>Updates</span>
              <strong>{updateRows.length}</strong>
            </div>
            <div>
              <span>Net unit delta</span>
              <strong className={netDelta < 0n ? "negative" : "positive"}>
                {formatDelta(netDelta)}
              </strong>
            </div>
            <div>
              <span>Locker</span>
              <strong>{shortAddress(state!.lockerAddress)}</strong>
            </div>
          </div>
          <div className="table-toolbar">
            <div>
              <h3>Campaign pool updates</h3>
              <p className="muted">
                CMS targets compared with current locker units.
              </p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={showCurrent}
                onChange={(event) => setShowCurrent(event.target.checked)}
              />{" "}
              Show current
            </label>
          </div>
          <div className="update-table-wrap">
            <table className="update-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Onchain</th>
                  <th>CMS target</th>
                  <th>Delta</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {relevantRows.map((row) => (
                  <tr
                    key={String(row.programId)}
                    className={isClaimablePointState(row) ? "needs-update" : ""}
                  >
                    <td data-label="Campaign">
                      <strong>{row.name}</strong>
                      <small>
                        Season {row.season ?? "—"} · #{String(row.programId)} ·{" "}
                        {row.category}
                      </small>
                    </td>
                    <td data-label="Onchain">
                      {formatUnits(row.onchainPoints)}
                    </td>
                    <td data-label="CMS target">
                      {formatUnits(row.offchainPoints)}
                    </td>
                    <td
                      data-label="Delta"
                      className={
                        row.offchainPoints < row.onchainPoints
                          ? "negative"
                          : "positive"
                      }
                    >
                      {formatDelta(row.offchainPoints - row.onchainPoints)}
                    </td>
                    <td data-label="Status">
                      <span
                        className={`state-pill ${isClaimablePointState(row) ? "pending" : "current"}`}
                      >
                        {!row.cmsCampaignExists
                          ? "Unavailable"
                          : row.isOnchainOutdated
                            ? "Update"
                            : "Current"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => toggleEvents(row)}
                      >
                        {eventProgram === row.programId
                          ? "Hide events"
                          : "Recent events"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {eventProgram !== undefined && (
            <section className="event-drawer">
              <div className="event-heading">
                <div>
                  <span className="eyebrow">CMS evidence</span>
                  <h3>Recent point events · Campaign {String(eventProgram)}</h3>
                </div>
                <button
                  className="text-button"
                  onClick={() => setEventProgram(undefined)}
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
          <div className="claim-action">
            <div>
              <strong>
                {updateRows.length
                  ? `${updateRows.length} pool update${updateRows.length === 1 ? "" : "s"} ready`
                  : "No pool updates needed"}
              </strong>
              <span>The wallet submits exact signed CMS targets.</span>
            </div>
            <button
              disabled={
                !stateMatchesAccount || !state?.canClaim || !window.ethereum
              }
              onClick={claim}
            >
              Update pool units
            </button>
          </div>
        </>
      )}
    </section>
  );
}
