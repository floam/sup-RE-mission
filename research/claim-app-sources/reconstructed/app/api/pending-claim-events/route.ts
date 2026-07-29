import {
  lockerAbi,
  lockerFactoryAbi,
  lockerFactoryAddress,
  programManagerAbi,
  programManagerAddress,
} from "@sfpro/sdk/abi/sup";
import { readContract } from "@wagmi/core";
import { getAddress, isAddress } from "viem";
import { base } from "viem/chains";

import { validateCmsCampaignBatch } from "../../../client/claim-batch";
import { getPublicPrograms } from "../../../client/programs";
import { serverWagmiConfig } from "../../../config/server-wagmi";
import { getClaimNonceWindow } from "../../../lib/claim-nonce-window";
import { cmsClient, requireCmsData } from "../../../lib/cms-client";
import { getCmsEventsForDelta } from "../../../lib/cms-events";

const CMS_BATCH_SIZE = 50;
const MAX_CAMPAIGNS = 250;

type ReconciliationStatus =
  | "matched"
  | "partial"
  | "capped"
  | "no-change";

interface SignedCampaignBalance {
  campaignId: number;
  claimablePoints: number;
  uncappedPoints: number;
  currentNonce: number;
}

interface CampaignExplanation {
  campaignId: number;
  reconciliationStatus: ReconciliationStatus;
  onchainPoints: number;
  uncappedPoints: number;
  claimablePoints: number;
  targetPoints: number;
  explainedPoints: number;
  lastClaimNonce: number;
  currentNonce: number;
  windowStart: string | null;
  windowEnd: string;
  events: Awaited<ReturnType<typeof getCmsEventsForDelta>>["events"];
}

function jsonError(message: string, status: number) {
  return Response.json({ message }, { status });
}

function safeNumber(value: bigint | number, label: string) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new Error(`${label} exceeds the safe integer range.`);
  }
  return number;
}


function parseCampaignIds(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_CAMPAIGNS) {
    throw new Error(`campaignIds must contain between 1 and ${MAX_CAMPAIGNS} IDs.`);
  }
  const ids = value.map(Number);
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error("campaignIds must contain positive safe integers.");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("campaignIds must not contain duplicates.");
  }
  return ids;
}

function chunkCampaignIds(campaignIds: number[]) {
  const batches: number[][] = [];
  for (let index = 0; index < campaignIds.length; index += CMS_BATCH_SIZE) {
    batches.push(campaignIds.slice(index, index + CMS_BATCH_SIZE));
  }
  return batches;
}

async function fetchSignedBalances(
  account: `0x${string}`,
  campaignIds: number[],
): Promise<SignedCampaignBalance[]> {
  const responses = await Promise.all(
    chunkCampaignIds(campaignIds).map(async (batch) => {
      const result = requireCmsData(
        "/points/signed-balance-batch",
        await cmsClient.POST("/points/signed-balance-batch", {
          body: { account, campaignIds: batch },
        }),
      );
      validateCmsCampaignBatch({
        label: "CMS pending-event signed balance batch",
        expectedAccount: account,
        expectedCampaignIds: batch,
        responseAccount: result.address,
        campaignIds: result.campaignIds,
        pointArrays: [result.points, result.uncappedPoints],
      });
      const currentNonce = safeNumber(
        result.signatureTimestamp,
        "CMS signed-balance nonce",
      );
      return result.campaignIds.map((campaignId, index) => ({
        campaignId,
        claimablePoints: result.points[index] ?? 0,
        uncappedPoints: result.uncappedPoints[index] ?? 0,
        currentNonce,
      }));
    }),
  );

  return responses.flat();
}

async function explainCampaigns(account: `0x${string}`, campaignIds: number[]) {
  const programs = await getPublicPrograms();
  const programIds = new Set(programs.map((program) => Number(program.id)));
  const requestedIds = campaignIds.filter((campaignId) => programIds.has(campaignId));
  if (requestedIds.length === 0) {
    throw new Error("None of the requested campaigns are active SUP programs.");
  }
  if (requestedIds.length !== campaignIds.length) {
    throw new Error("One or more requested campaigns are not active SUP programs.");
  }

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
  const locker = getAddress(lockerAddress);

  const [signedBalances, chainValues] = await Promise.all([
    fetchSignedBalances(account, requestedIds),
    Promise.all(
      requestedIds.map(async (campaignId) => {
        const [onchainPoints, nextValidNonce] = await Promise.all([
          lockerCreated
            ? readContract(serverWagmiConfig, {
                authorizationList: undefined,
                address: locker,
                abi: lockerAbi,
                chainId: base.id,
                functionName: "getUnitsPerProgram",
                args: [BigInt(campaignId)],
              })
            : Promise.resolve(0n),
          readContract(serverWagmiConfig, {
            authorizationList: undefined,
            address: programManagerAddress[base.id],
            abi: programManagerAbi,
            chainId: base.id,
            functionName: "getNextValidNonce",
            args: [BigInt(campaignId), account],
          }),
        ]);
        return { campaignId, onchainPoints, nextValidNonce };
      }),
    ),
  ]);

  const signedByCampaign = new Map(
    signedBalances.map((balance) => [balance.campaignId, balance]),
  );
  const chainByCampaign = new Map(
    chainValues.map((value) => [value.campaignId, value]),
  );

  const explanations = await Promise.all(
    requestedIds.map(async (campaignId): Promise<CampaignExplanation> => {
      const signed = signedByCampaign.get(campaignId);
      const chain = chainByCampaign.get(campaignId);
      if (!signed || !chain) {
        throw new Error(`Campaign ${campaignId} was omitted from explanation inputs.`);
      }

      const onchainPoints = safeNumber(
        chain.onchainPoints,
        `Campaign ${campaignId} onchain units`,
      );
      const { claimablePoints, uncappedPoints, currentNonce } = signed;
      const nonceWindow = getClaimNonceWindow(chain.nextValidNonce, currentNonce);
      const { lastClaimNonce, startTime: windowStart, endTime: windowEnd } =
        nonceWindow;
      if (
        !Number.isSafeInteger(uncappedPoints) ||
        !Number.isSafeInteger(claimablePoints)
      ) {
        throw new Error(`Campaign ${campaignId} returned unsafe CMS point values.`);
      }
      const targetPoints = uncappedPoints - onchainPoints;
      if (!Number.isSafeInteger(targetPoints)) {
        throw new Error(`Campaign ${campaignId} point difference is unsafe.`);
      }
      const baseResult = {
        campaignId,
        onchainPoints,
        uncappedPoints,
        claimablePoints,
        targetPoints,
        lastClaimNonce,
        currentNonce,
        windowStart,
        windowEnd,
      };

      if (uncappedPoints !== claimablePoints) {
        return {
          ...baseResult,
          reconciliationStatus: "capped",
          explainedPoints: 0,
          events: [],
        };
      }
      if (targetPoints === 0) {
        return {
          ...baseResult,
          reconciliationStatus: "no-change",
          explainedPoints: 0,
          events: [],
        };
      }

      const reconciliation = await getCmsEventsForDelta({
        account,
        campaignId,
        targetPoints,
        startTime: windowStart ?? undefined,
        endTime: windowEnd,
      });
      return {
        ...baseResult,
        reconciliationStatus: reconciliation.matched ? "matched" : "partial",
        explainedPoints: reconciliation.explainedPoints,
        events: reconciliation.events,
      };
    }),
  );

  return {
    account,
    lockerAddress: lockerCreated ? locker : null,
    results: explanations,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      account?: unknown;
      campaignIds?: unknown;
    };
    if (typeof body.account !== "string" || !isAddress(body.account)) {
      return jsonError("A valid account is required", 400);
    }
    const campaignIds = parseCampaignIds(body.campaignIds);
    return Response.json(await explainCampaigns(getAddress(body.account), campaignIds));
  } catch (error) {
    console.error("Failed to explain pending claim events", error);
    return jsonError(
      error instanceof Error
        ? error.message
        : "Failed to explain pending claim events",
      500,
    );
  }
}
