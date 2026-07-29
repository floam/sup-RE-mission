import assert from "node:assert/strict";
import test from "node:test";

import { getAddress, isAddress, zeroAddress } from "viem";

import {
  buildClaimProgramPlan,
  getClaimResultKind,
} from "../client/claim-program-plan.ts";
import {
  getProgramStatus,
  getPublicPrograms,
  SUP_SUBGRAPH,
  type PublicProgram,
} from "../client/programs.ts";
import {
  createCmsClient,
  requireCmsData,
  type CmsBalance,
  type CmsPointEvent,
} from "../lib/cms-client.ts";

const REQUEST_TIMEOUT_MS = Number(process.env.E2E_REQUEST_TIMEOUT_MS ?? "15000");
const REQUEST_ATTEMPTS = Number(process.env.E2E_REQUEST_ATTEMPTS ?? "3");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const fetchWithRetry: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  let lastError: unknown;

  for (let attempt = 1; attempt <= REQUEST_ATTEMPTS; attempt += 1) {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = AbortSignal.any([request.signal, timeout]);

    try {
      const response = await fetch(request.clone(), { signal });
      const retryable =
        response.status === 408 || response.status === 429 || response.status >= 500;
      if (!retryable || attempt === REQUEST_ATTEMPTS) return response;
      await response.body?.cancel();
    } catch (error) {
      lastError = error;
      if (request.signal.aborted || attempt === REQUEST_ATTEMPTS) throw error;
    }

    await sleep(250 * 2 ** (attempt - 1));
  }

  throw lastError;
};

const cms = createCmsClient({
  origin: process.env.CMS_BASE_URL,
  fetch: fetchWithRetry,
});
const FALLBACK_ACCOUNT =
  process.env.E2E_ACCOUNT ?? "0xdBb811EC62338db94858Ec21ef1d56B658111922";
const PREFERRED_CAMPAIGN_ID = Number(process.env.E2E_CAMPAIGN_ID ?? "608");
const DISCOVERY_LIMIT = Number(process.env.E2E_DISCOVERY_LIMIT ?? "40");

interface LiveSample {
  source: "cms-event" | "fallback-account";
  campaignId: number;
  account: string;
  balance: CmsBalance;
  event?: CmsPointEvent;
}

function assertSafeInteger(value: unknown, label: string): asserts value is number {
  assert(
    typeof value === "number" && Number.isSafeInteger(value),
    `${label} must be a safe integer; received ${String(value)}`,
  );
}

function assertAddress(value: unknown, label: string): asserts value is string {
  assert(
    typeof value === "string" && isAddress(value),
    `${label} must be an EVM address`,
  );
}

function assertDecimalString(value: unknown, label: string): asserts value is string {
  assert(typeof value === "string" && /^\d+$/.test(value), `${label} must be decimal`);
}

function assertSubgraphProgramsSane(programs: readonly PublicProgram[]) {
  assert(programs.length > 0, "SUP subgraph returned no programs");

  const ids = new Set<string>();
  let hasScheduledEnd = false;
  for (const program of programs) {
    assert.match(program.id, /^[1-9]\d*$/, "program.id must be a positive integer");
    assert(!ids.has(program.id), `SUP subgraph returned duplicate program ${program.id}`);
    ids.add(program.id);

    assertAddress(program.distributionPool, `program ${program.id} distributionPool`);
    assert.notEqual(
      getAddress(program.distributionPool),
      getAddress(zeroAddress),
      `program ${program.id} has zero pool`,
    );
    assertDecimalString(program.fundingAmount, `program ${program.id} fundingAmount`);
    assertDecimalString(program.subsidyAmount, `program ${program.id} subsidyAmount`);
    assertDecimalString(program.endDate, `program ${program.id} endDate`);
    if (BigInt(program.endDate) > 0n) hasScheduledEnd = true;

    for (const [field, value] of [
      ["earlyEndDate", program.earlyEndDate],
      ["stoppedDate", program.stoppedDate],
      ["cancellationDate", program.cancellationDate],
    ] as const) {
      if (value !== null) assertDecimalString(value, `program ${program.id} ${field}`);
    }

    assert(
      ["Active", "Finished", "Stopped"].includes(getProgramStatus(program)),
      `program ${program.id} has an unknown lifecycle state`,
    );
  }
  assert(hasScheduledEnd, "SUP subgraph returned no program with a scheduled end");
}

function assertBalance(balance: CmsBalance, expectedAccount: string) {
  assertAddress(balance.account, "CMS balance account");
  assert.equal(getAddress(balance.account), getAddress(expectedAccount));
  assertSafeInteger(balance.points, "CMS balance points");
  assertSafeInteger(balance.cappedPoints, "CMS balance cappedPoints");
}

async function getBalance(campaignId: number, account: string) {
  const result = await cms.GET("/points/balance", {
    params: { query: { campaignId, account } },
  });
  return requireCmsData("/points/balance", result);
}

async function getBalances(account: string, campaignIds: readonly number[]) {
  const result = await cms.POST("/points/balance-batch", {
    body: { account, campaignIds: [...campaignIds] },
  });
  return requireCmsData("/points/balance-batch", result);
}

async function getEventsPage(campaignId: number) {
  const result = await cms.GET("/points/events", {
    params: { query: { campaignId, page: 1, limit: 100 } },
  });
  return requireCmsData("/points/events", result);
}

async function discoverLiveSample(campaignIds: readonly number[]): Promise<LiveSample> {
  const candidates = [...campaignIds]
    .sort((left, right) => right - left)
    .slice(0, DISCOVERY_LIMIT);

  for (const campaignId of candidates) {
    let events: CmsPointEvent[];
    try {
      events = (await getEventsPage(campaignId)).events;
    } catch (error) {
      if (String(error).includes("returned 404")) continue;
      throw error;
    }

    for (const event of events) {
      assertAddress(event.account, "CMS event account");
      assertSafeInteger(event.points, "CMS event points");
      assert(
        typeof event.eventName === "string" && event.eventName.length > 0,
        "CMS event name must be non-empty",
      );
      assert(
        Number.isFinite(Date.parse(event.createdAt)),
        "CMS event createdAt must be a timestamp",
      );
      if (getAddress(event.account) === getAddress(zeroAddress) || event.points === 0) {
        continue;
      }

      const balance = await getBalance(campaignId, event.account);
      assertBalance(balance, event.account);
      if (balance.points !== 0 || balance.cappedPoints !== 0) {
        return {
          source: "cms-event",
          campaignId,
          account: getAddress(event.account),
          balance,
          event,
        };
      }
    }
  }

  assert(isAddress(FALLBACK_ACCOUNT), "E2E_ACCOUNT fallback must be a valid address");
  const campaignId = campaignIds.includes(PREFERRED_CAMPAIGN_ID)
    ? PREFERRED_CAMPAIGN_ID
    : campaignIds[0];
  assert(campaignId, "claim plan produced no active CMS campaign fallback");
  const account = getAddress(FALLBACK_ACCOUNT);
  const balance = await getBalance(campaignId, account);
  assertBalance(balance, account);
  return {
    source: "fallback-account",
    campaignId,
    account,
    balance,
  };
}

test(
  "live SUP subgraph and generated CMS client produce a coherent active-claim sample",
  { timeout: 180_000 },
  async () => {
    const programs = await getPublicPrograms();
    assertSubgraphProgramsSane(programs);

    const plan = buildClaimProgramPlan(programs);
    assert.equal(plan.cmsCampaignIds.length, plan.comparablePrograms.length);
    assert(plan.cmsBatches.length > 0, "claim plan produced no active CMS batches");
    assert(plan.cmsBatches.every((batch) => batch.length > 0 && batch.length <= 50));

    const existenceBatches = await Promise.all(
      plan.cmsBatches.map(async (campaignIds) => {
        const batch = await getBalances(zeroAddress, campaignIds);
        assert.equal(getAddress(batch.address), getAddress(zeroAddress));
        assert.deepEqual(batch.campaignIds, campaignIds);
        assert.equal(batch.points.length, campaignIds.length);
        assert.equal(batch.cappedPoints.length, campaignIds.length);
        return batch;
      }),
    );
    const missingCampaignIds = new Set(
      existenceBatches.flatMap((batch) =>
        (batch.warnings ?? [])
          .filter((warning) => warning.message === "Campaign not found")
          .map((warning) => warning.campaignId),
      ),
    );
    const cmsCampaignIds = plan.cmsCampaignIds.filter(
      (campaignId) => !missingCampaignIds.has(campaignId),
    );
    assert(cmsCampaignIds.length > 0, "CMS and active SUP programs do not overlap");

    const sample = await discoverLiveSample(cmsCampaignIds);
    assert(
      sample.balance.points !== 0 || sample.balance.cappedPoints !== 0,
      `live sample ${sample.account} in campaign ${sample.campaignId} returned only zero balances`,
    );

    const accountBatches = await Promise.all(
      plan.cmsBatches.map((campaignIds) => getBalances(sample.account, campaignIds)),
    );
    assert.deepEqual(
      accountBatches.flatMap((batch) => batch.campaignIds),
      plan.cmsCampaignIds,
    );

    const sampleBatch = accountBatches.find((batch) =>
      batch.campaignIds.includes(sample.campaignId),
    );
    assert(sampleBatch, "selected sample campaign was absent from batch response");
    const sampleIndex = sampleBatch.campaignIds.indexOf(sample.campaignId);
    assert.equal(sampleBatch.points[sampleIndex], sample.balance.points);
    assert.equal(sampleBatch.cappedPoints[sampleIndex], sample.balance.cappedPoints);

    const resultKind = getClaimResultKind({
      lockerReady: true,
      comparableProgramCount: plan.comparablePrograms.length,
      changedProgramCount: 0,
    });
    assert.equal(resultKind, "synchronized");

    console.log(
      JSON.stringify(
        {
          subgraph: SUP_SUBGRAPH,
          subgraphPrograms: programs.length,
          cmsCampaigns: cmsCampaignIds.length,
          activePrograms: plan.comparablePrograms.length,
          sampleSource: sample.source,
          sampleCampaignId: sample.campaignId,
          sampleAccount: sample.account,
          sampleEvent: sample.event
            ? {
                eventName: sample.event.eventName,
                points: sample.event.points,
                createdAt: sample.event.createdAt,
              }
            : null,
          sampleBalance: sample.balance,
          resultKind,
        },
        null,
        2,
      ),
    );
  },
);
