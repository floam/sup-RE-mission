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
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
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
}

interface CmsSignedBalanceResponse {
  campaignIds: number[];
  points: number[];
  signatureTimestamp: number;
  signature: `0x${string}`;
}

interface WalletProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
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
  for (const balance of balances) {
    const targets = balance.cappedPoints ?? balance.points;
    balance.campaignIds.forEach((id, index) =>
      cappedByProgram.set(id, BigInt(targets[index] ?? 0)),
    );
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

function getWalletProvider() {
  return window.ethereum as unknown as WalletProvider | undefined;
}

function formatUnits(value: bigint) {
  return new Intl.NumberFormat("en-US").format(value);
}

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function getCampaign(programId: bigint) {
  return PROGRAM_APP_DEFINITIONS.find(
    (app) => app.program?.id === Number(programId),
  );
}

function CampaignChange({ row }: { row: PointState }) {
  const campaign = getCampaign(row.programId);
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
          <h4>{campaign?.name ?? `Campaign ${row.programId}`}</h4>
          <p className="campaign-meta">
            {campaign
              ? `Season ${campaign.season} · #${row.programId} · ${campaign.category}`
              : `Campaign #${row.programId}`}
          </p>
        </div>
        <span
          className={row.isOnchainOutdated ? "update-pill" : "current-pill"}
        >
          {row.isOnchainOutdated ? "Update available" : "Synchronized"}
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
        <strong className={delta >= 0n ? "positive" : ""}>
          {delta > 0n ? "+" : ""}
          {formatUnits(delta)} units
        </strong>
      </div>
      <details className="technical-details">
        <summary>Technical details</summary>
        <p>
          Campaign #{row.programId}. Current locker pool units are compared with
          the signed CMS allocation target.
        </p>
      </details>
    </article>
  );
}

export function ClaimPanel() {
  const [account, setAccount] = useState("");
  const [walletConnected, setWalletConnected] = useState(false);
  const [state, setState] = useState<State>();
  const [message, setMessage] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const checkRequest = useRef(0);

  function updateAccount(nextAccount: string) {
    checkRequest.current += 1;
    setAccount(nextAccount);
    setState(undefined);
    setMessage("");
  }

  async function connect() {
    const provider = getWalletProvider();
    if (!provider) throw new Error("No injected wallet found.");
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
    })) as string[];
    const connectedAccount = accounts[0] ?? "";
    updateAccount(connectedAccount);
    setWalletConnected(Boolean(connectedAccount));
  }

  async function check() {
    if (!isAddress(account)) return setMessage("Enter a valid EVM address.");
    const checkedAccount = getAddress(account);
    const request = ++checkRequest.current;
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
    const provider = getWalletProvider();
    if (
      !state?.canClaim ||
      !state.lockerCreated ||
      state.lockerAddress === ZERO_ADDRESS ||
      !isAddress(account) ||
      getAddress(account) !== state.account ||
      !provider
    )
      return;
    const selected = state.programPointStates.filter(isClaimablePointState);
    setMessage("Preparing your campaign update…");
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
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
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

  const stateMatchesAccount =
    state !== undefined &&
    isAddress(account) &&
    getAddress(account) === state.account;
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
  const campaignNames = changedRows
    .map((row) => getCampaign(row.programId)?.name)
    .filter(Boolean);

  return (
    <section className="claim-workbench">
      <div className="wallet-step">
        <span className="eyebrow">Wallet</span>
        <h2>Check for campaign updates</h2>
        <p className="muted">
          Connect your wallet, then compare its current on-chain units with the
          latest campaign allocations.
        </p>
        <label className="account-field">
          <span>Wallet address</span>
          <input
            value={account}
            onChange={(event) => updateAccount(event.target.value)}
            placeholder="0x…"
            inputMode="text"
          />
        </label>
        {!walletConnected ? (
          <button
            className="primary-action"
            onClick={() =>
              connect().catch((error) => setMessage(String(error)))
            }
          >
            Connect wallet
          </button>
        ) : (
          <button
            className="primary-action"
            disabled={isChecking}
            onClick={check}
          >
            {isChecking ? "Checking…" : "Check for updates"}
          </button>
        )}
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
                Updating will {totalDelta >= 0n ? "increase" : "adjust"} your{" "}
                {campaignNames.join(", ") || "campaign"} allocation by{" "}
                <strong>
                  {totalDelta > 0n ? "+" : ""}
                  {formatUnits(totalDelta)} units
                </strong>
                . This requires one transaction and does not move your funds.
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
              <strong className="positive">
                {totalDelta > 0n ? "+" : ""}
                {formatUnits(totalDelta)} units
              </strong>
            </div>
            <div>
              <span>Transactions</span>
              <strong>{changedRows.length ? "1" : "0"}</strong>
            </div>
          </div>

          {populatedRows.length > 0 && (
            <section className="campaign-list">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Campaign changes</span>
                  <h3>Your allocation details</h3>
                  <p className="muted">
                    Review what is on-chain now and the latest campaign target.
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
                  <CampaignChange key={String(row.programId)} row={row} />
                ))}
              </div>
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
                  One wallet transaction synchronizes every update shown above.
                </span>
              </div>
              <button
                className="primary-action"
                disabled={!state.canClaim || !getWalletProvider()}
                onClick={claim}
              >
                Synchronize campaign allocations
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
