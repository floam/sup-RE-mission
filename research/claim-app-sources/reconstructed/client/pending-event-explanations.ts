import { programManagerAbi, programManagerAddress } from "@sfpro/sdk/abi/sup";
import { readContract, type Config } from "@wagmi/core";
import type { Address } from "viem";
import { base } from "viem/chains";

import { getClaimNonceWindow } from "../lib/claim-nonce-window";
import { cmsClient, requireCmsData } from "../lib/cms-client";
import { getCmsEventsForDelta } from "../lib/cms-events";
import { validateCmsCampaignBatch } from "./claim-batch";
import type { PointState } from "./claim-chain";
import type { EventBreakdown } from "./claim-event-breakdown";
import { chunkItems, CMS_BATCH_SIZE } from "./claim-program-plan";

const numberFormat = new Intl.NumberFormat("en-US");

interface SignedCampaignBalance {
  campaignId: number;
  claimablePoints: number;
  uncappedPoints: number;
  currentNonce: number;
}

function safeNumber(value: bigint | number, label: string) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new Error(`${label} exceeds the safe integer range.`);
  }
  return number;
}

async function fetchSignedBalances(
  account: Address,
  rows: readonly PointState[],
): Promise<SignedCampaignBalance[]> {
  const responses = await Promise.all(
    chunkItems(rows, CMS_BATCH_SIZE).map(async (batch) => {
      const campaignIds = batch.map((row) => Number(row.programId));
      const result = requireCmsData(
        "/points/signed-balance-batch",
        await cmsClient.POST("/points/signed-balance-batch", {
          body: { account, campaignIds },
        }),
      );
      validateCmsCampaignBatch({
        label: "CMS explanation signed balance batch",
        expectedAccount: account,
        expectedCampaignIds: campaignIds,
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

export async function explainPendingCampaigns(
  config: Config,
  account: Address,
  rows: readonly PointState[],
): Promise<EventBreakdown[]> {
  if (rows.length === 0) return [];

  const signedBalances = await fetchSignedBalances(account, rows);
  const signedByCampaign = new Map(
    signedBalances.map((balance) => [balance.campaignId, balance]),
  );

  return Promise.all(
    rows.map(async (row): Promise<EventBreakdown> => {
      const campaignId = Number(row.programId);
      const signed = signedByCampaign.get(campaignId);
      if (!signed) {
        throw new Error(
          `Campaign ${campaignId} was omitted from the signed explanation batch.`,
        );
      }
      if (
        BigInt(signed.uncappedPoints) !== row.uncappedPoints ||
        BigInt(signed.claimablePoints) !== row.offchainPoints
      ) {
        throw new Error(
          `Campaign ${campaignId} changed while its explanation was loading. Refresh and try again.`,
        );
      }

      const nextValidNonce = await readContract(config, {
        authorizationList: undefined,
        address: programManagerAddress[base.id],
        abi: programManagerAbi,
        chainId: base.id,
        functionName: "getNextValidNonce",
        args: [row.programId, account],
      });
      const { startTime, endTime } = getClaimNonceWindow(
        nextValidNonce,
        signed.currentNonce,
      );
      const targetPoints = safeNumber(
        row.uncappedPoints - row.onchainPoints,
        `Campaign ${campaignId} point difference`,
      );
      const reconciliation = await getCmsEventsForDelta({
        account,
        campaignId,
        targetPoints,
        startTime: startTime ?? undefined,
        endTime,
      });

      return {
        selection: { account, programId: row.programId },
        events: reconciliation.events,
        message: reconciliation.matched
          ? ""
          : `The available event history explains ${numberFormat.format(reconciliation.explainedPoints)} of ${numberFormat.format(targetPoints)} points.`,
      };
    }),
  );
}
