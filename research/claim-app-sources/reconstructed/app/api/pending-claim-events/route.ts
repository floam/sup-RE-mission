import {
  lockerAbi,
  lockerFactoryAbi,
  lockerFactoryAddress,
} from "@sfpro/sdk/abi/sup";
import { readContract } from "@wagmi/core";
import { getAddress, isAddress } from "viem";
import { base } from "viem/chains";

import { getPublicPrograms } from "../../../client/programs";
import { serverWagmiConfig } from "../../../config/server-wagmi";
import { cmsClient, requireCmsData } from "../../../lib/cms-client";
import { getCmsEventsForDelta } from "../../../lib/cms-events";

function jsonError(message: string, status: number) {
  return Response.json({ message }, { status });
}

function safeNumber(value: bigint, label: string) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new Error(`${label} exceeds the safe integer range.`);
  }
  return number;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const accountParam = url.searchParams.get("account");
    const campaignIdParam = url.searchParams.get("campaignId");

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
    const locker = getAddress(lockerAddress);
    const onchainPoints = lockerCreated
      ? await readContract(serverWagmiConfig, {
          authorizationList: undefined,
          address: locker,
          abi: lockerAbi,
          chainId: base.id,
          functionName: "getUnitsPerProgram",
          args: [BigInt(campaignId)],
        })
      : 0n;

    const balance = requireCmsData(
      "/points/balance",
      await cmsClient.GET("/points/balance", {
        params: { query: { account, campaignId } },
      }),
    );
    if (!Number.isSafeInteger(balance.points) || !Number.isSafeInteger(balance.cappedPoints)) {
      throw new Error("CMS balance returned points outside the safe integer range.");
    }

    const currentOnchainPoints = safeNumber(onchainPoints, "Onchain campaign units");
    const targetPoints = balance.points - currentOnchainPoints;
    if (!Number.isSafeInteger(targetPoints)) {
      throw new Error("Campaign point difference exceeds the safe integer range.");
    }

    const isCapped = balance.points !== balance.cappedPoints;
    const reconciliation = isCapped
      ? {
          events: [],
          targetPoints,
          explainedPoints: 0,
          matched: false,
          exhausted: false,
        }
      : await getCmsEventsForDelta({ account, campaignId, targetPoints });

    return Response.json({
      account,
      campaignId,
      lockerAddress: lockerCreated ? locker : null,
      poolAddress: getAddress(program.distributionPool),
      boundaryStatus: lockerCreated ? "confirmed-claim" : "no-locker",
      lastClaimAt: null,
      lastIndexedClaimAt: null,
      reconciliationStatus: isCapped
        ? "capped"
        : reconciliation.matched
          ? "matched"
          : "partial",
      onchainPoints: currentOnchainPoints,
      uncappedPoints: balance.points,
      claimablePoints: balance.cappedPoints,
      targetPoints: reconciliation.targetPoints,
      explainedPoints: reconciliation.explainedPoints,
      events: reconciliation.events,
    });
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
