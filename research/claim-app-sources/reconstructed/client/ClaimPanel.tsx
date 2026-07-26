"use client";

import { useRef, useState } from "react";
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
      state.lockerAddress ===
        "0x0000000000000000000000000000000000000000" ||
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
  const visibleRows = stateMatchesAccount
    ? state.programPointStates.filter(
        (row) => row.offchainPoints > 0n || row.onchainPoints > 0n,
      )
    : undefined;
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
          onChange={(event) => updateAccount(event.target.value)}
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
            disabled={
              !stateMatchesAccount || !state?.canClaim || !window.ethereum
            }
            onClick={claim}
          >
            Claim with wallet
          </button>
        </>
      )}
    </section>
  );
}
