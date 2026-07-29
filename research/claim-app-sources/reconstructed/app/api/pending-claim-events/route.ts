import {
  lockerAbi,
  lockerFactoryAbi,
  lockerFactoryAddress,
} from "@sfpro/sdk/abi/sup";
import { getPublicClient, readContract } from "@wagmi/core";
import { getAbiItem, getAddress, isAddress } from "viem";
import { base } from "viem/chains";

import {
  getPublicPrograms,
  SUP_SUBGRAPH,
} from "../../../client/programs";
import { serverWagmiConfig } from "../../../config/server-wagmi";
import { getCmsEventsSince } from "../../../lib/cms-events";

const MAX_INDEXED_CLAIM_EVENTS = 1_000;
const MAX_BOUNDARY_CONFIRMATIONS = 25;
const publicClient = getPublicClient(serverWagmiConfig, { chainId: base.id });
const fluidStreamClaimedEvent = getAbiItem({
  abi: lockerAbi,
  name: "FluidStreamClaimed",
});
const fluidStreamsClaimedEvent = getAbiItem({
  abi: lockerAbi,
  name: "FluidStreamsClaimed",
});

interface IndexedClaimEvent {
  id: string;
  blockNumber: string;
  blockTimestamp: string;
  transactionHash: `0x${string}`;
  units: Array<{ programId: string }>;
}

type BoundaryStatus =
  | "confirmed-claim"
  | "indexed-claim-unverified"
  | "no-claim"
  | "no-locker";

function jsonError(message: string, status: number) {
  return Response.json({ message }, { status });
}

function claimTimestamp(event: IndexedClaimEvent | undefined) {
  if (!event) return null;
  const timestamp = Number(event.blockTimestamp);
  return Number.isSafeInteger(timestamp)
    ? new Date(timestamp * 1_000).toISOString()
    : null;
}

async function fetchIndexedClaimEvents(locker: `0x${string}`) {
  const response = await fetch(SUP_SUBGRAPH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: `query LockerClaims($locker: Bytes!) {
        fluidStreamClaimEvents(
          first: ${MAX_INDEXED_CLAIM_EVENTS}
          orderBy: blockTimestamp
          orderDirection: desc
          where: { locker: $locker }
        ) {
          id
          blockNumber
          blockTimestamp
          transactionHash
          units(first: 1000) {
            programId
          }
        }
      }`,
      variables: { locker: locker.toLowerCase() },
    }),
    next: { revalidate: 30 },
  });
  if (!response.ok) throw new Error(`SUP subgraph returned ${response.status}`);

  const payload = (await response.json()) as {
    data?: { fluidStreamClaimEvents: IndexedClaimEvent[] };
    errors?: unknown;
  };
  if (!payload.data) {
    throw new Error(
      `SUP claim-event query failed: ${JSON.stringify(payload.errors)}`,
    );
  }
  return payload.data.fluidStreamClaimEvents;
}

async function isVerifiedClaimEvent(input: {
  event: IndexedClaimEvent;
  locker: `0x${string}`;
  campaignId: number;
}) {
  const blockNumber = BigInt(input.event.blockNumber);
  const expectedHash = input.event.transactionHash.toLowerCase();
  const [singleClaims, batchClaims] = await Promise.all([
    publicClient.getLogs({
      address: input.locker,
      event: fluidStreamClaimedEvent,
      args: { programId: BigInt(input.campaignId) },
      fromBlock: blockNumber,
      toBlock: blockNumber,
    }),
    publicClient.getLogs({
      address: input.locker,
      event: fluidStreamsClaimedEvent,
      fromBlock: blockNumber,
      toBlock: blockNumber,
    }),
  ]);

  return [...singleClaims, ...batchClaims].some(
    (claimLog) => claimLog.transactionHash?.toLowerCase() === expectedHash,
  );
}

async function findClaimBoundary(input: {
  locker: `0x${string}`;
  campaignId: number;
}) {
  const indexedClaims = (await fetchIndexedClaimEvents(input.locker)).filter(
    (event) =>
      event.units.some((unit) => Number(unit.programId) === input.campaignId),
  );
  let confirmations = 0;

  for (const event of indexedClaims.slice(0, MAX_BOUNDARY_CONFIRMATIONS)) {
    confirmations += 1;
    try {
      if (
        await isVerifiedClaimEvent({
          event,
          locker: input.locker,
          campaignId: input.campaignId,
        })
      ) {
        return {
          confirmedClaim: event,
          indexedClaim: indexedClaims[0],
          confirmations,
        };
      }
    } catch (error) {
      console.warn("Failed to verify indexed claim event", {
        eventId: event.id,
        error,
      });
    }
  }

  return {
    confirmedClaim: undefined,
    indexedClaim: indexedClaims[0],
    confirmations,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const accountParam = url.searchParams.get("account");
    const campaignIdParam = url.searchParams.get("campaignId");
    const debug = url.searchParams.get("debug") === "1";

    if (!accountParam || !isAddress(accountParam)) {
      return jsonError("A valid account is required", 400);
    }

    const campaignId = Number(campaignIdParam);
    if (!Number.isSafeInteger(campaignId) || campaignId <= 0) {
      return jsonError("A valid campaignId is required", 400);
    }

    const account = getAddress(accountParam);
    const program = (await getPublicPrograms()).find(
      (candidate) => Number(candidate.id) === campaignId,
    );
    if (!program) return jsonError("Campaign not found", 404);

    const [lockerCreated, lockerAddress] = await readContract(
      serverWagmiConfig,
      {
        authorizationList: undefined,
        address: lockerFactoryAddress[base.id],
        abi: lockerFactoryAbi,
        chainId: base.id,
        functionName: "getUserLocker",
        args: [account],
      },
    );
    const pool = getAddress(program.distributionPool);

    if (!lockerCreated) {
      return Response.json({
        account,
        campaignId,
        lockerAddress: null,
        poolAddress: pool,
        boundaryStatus: "no-locker" satisfies BoundaryStatus,
        lastClaimAt: null,
        lastIndexedClaimAt: null,
        events: [],
      });
    }

    const locker = getAddress(lockerAddress);
    const boundary = await findClaimBoundary({ locker, campaignId });
    const lastClaimAt = claimTimestamp(boundary.confirmedClaim);
    const lastIndexedClaimAt = claimTimestamp(boundary.indexedClaim);
    const boundaryStatus: BoundaryStatus = boundary.confirmedClaim
      ? "confirmed-claim"
      : boundary.indexedClaim
        ? "indexed-claim-unverified"
        : "no-claim";
    const events = lastClaimAt
      ? await getCmsEventsSince({
          account,
          campaignId,
          startTime: lastClaimAt,
        })
      : [];

    return Response.json({
      account,
      campaignId,
      lockerAddress: locker,
      poolAddress: pool,
      boundaryStatus,
      lastClaimAt,
      lastIndexedClaimAt,
      events,
      ...(debug
        ? {
            boundaryConfirmations: boundary.confirmations,
            confirmedClaimEvent: boundary.confirmedClaim ?? null,
            indexedClaimEvent: boundary.indexedClaim ?? null,
          }
        : {}),
    });
  } catch (error) {
    console.error("Failed to build pending claim events", error);
    return jsonError(
      error instanceof Error
        ? error.message
        : "Failed to build pending claim events",
      500,
    );
  }
}
