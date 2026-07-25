"use client";

import { useState } from "react";
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
import { SUP_SUBGRAPH } from "./programs";

const CMS_BASE = "https://cms.superfluid.pro";
const PROTOCOL_SUBGRAPH =
  "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1";
const publicClient = createPublicClient({
  chain: base,
  transport: http(ALCHEMY_RPC_URLS[8453]),
});
const factoryAbi = parseAbi([
  "function getUserLocker(address user) view returns (address)",
]);
const batchClaimAbi = parseAbi([
  "function claim(uint256[] programIds, uint256[] totalProgramUnits, uint256 nonce, bytes stackSignature)",
]);

interface PointState {
  programId: bigint;
  offchainPoints: bigint;
  onchainPoints: bigint;
  isOnchainOutdated: boolean;
}

interface State {
  lockerAddress: Address;
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
  const lockerAddress = await publicClient.readContract({
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
  const { programs } = await queryGraph<{
    programs: Array<{ id: string; distributionPool: string }>;
  }>(
    SUP_SUBGRAPH,
    `query ClaimPools($ids: [String!]!) {
      programs(first: 1000, where: { id_in: $ids }) { id distributionPool }
    }`,
    { ids: programIds.map(String) },
  );
  const poolToProgram = new Map(
    programs.map((program) => [
      program.distributionPool.toLowerCase(),
      Number(program.id),
    ]),
  );
  const poolIds = [...poolToProgram.keys()];
  const onchainByProgram = new Map<number, bigint>();
  if (lockerAddress !== "0x0000000000000000000000000000000000000000") {
    const { poolMembers } = await queryGraph<{
      poolMembers: Array<{ units: string; pool: { id: string } }>;
    }>(
      PROTOCOL_SUBGRAPH,
      `query LockerUnits($account: String!, $pools: [String!]!) {
        poolMembers(first: 1000, where: { account: $account, pool_in: $pools }) {
          units
          pool { id }
        }
      }`,
      { account: lockerAddress.toLowerCase(), pools: poolIds },
    );
    for (const member of poolMembers) {
      const programId = poolToProgram.get(member.pool.id.toLowerCase());
      if (programId !== undefined)
        onchainByProgram.set(programId, BigInt(member.units));
    }
  }
  const programPointStates = programIds.map((programId) => {
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
    lockerAddress: getAddress(lockerAddress),
    canClaim: programPointStates.some(
      (row) => row.offchainPoints > 0n && row.isOnchainOutdated,
    ),
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

  async function connect() {
    const provider = getWalletProvider();
    if (!provider) throw new Error("No injected wallet found");
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
    })) as string[];
    setAccount(accounts[0] ?? "");
  }

  async function check() {
    if (!isAddress(account)) return setMessage("Enter a valid EVM address.");
    setMessage("Loading CMS targets and onchain units…");
    try {
      const nextState = await buildPointState(getAddress(account));
      setState(nextState);
      setMessage(
        nextState.canClaim
          ? "Updates are ready to claim."
          : "Your onchain units are current.",
      );
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function claim() {
    const provider = getWalletProvider();
    if (!state?.lockerAddress || !provider) return;
    const selected = state.programPointStates.filter(
      (row) => row.offchainPoints > 0n && row.isOnchainOutdated,
    );
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

  const visibleRows = state?.programPointStates.filter(
    (row) => row.offchainPoints > 0n || row.onchainPoints > 0n,
  );
  return (
    <section className="card">
      <h2>Check eligibility</h2>
      <p className="muted">
        CMS target points and indexed pool units are read directly in your
        browser.
      </p>
      <div className="toolbar">
        <input
          style={{ flex: 1, minWidth: 240 }}
          value={account}
          onChange={(event) => setAccount(event.target.value)}
          placeholder="0x…"
        />
        <button
          onClick={() => connect().catch((error) => setMessage(String(error)))}
        >
          Connect
        </button>
        <button onClick={check}>Check</button>
      </div>
      {message && <p className="status">{message}</p>}
      {visibleRows && (
        <>
          <div className="grid">
            {visibleRows.map((row) => (
              <article key={String(row.programId)}>
                <span className="tag">Program {String(row.programId)}</span>
                <p className="amount">{String(row.offchainPoints)} points</p>
                <p className="muted">
                  Onchain: {String(row.onchainPoints)} ·{" "}
                  {row.isOnchainOutdated ? "update available" : "current"}
                </p>
              </article>
            ))}
          </div>
          <button
            disabled={!state?.canClaim || !window.ethereum}
            onClick={claim}
          >
            Claim with wallet
          </button>
        </>
      )}
    </section>
  );
}
