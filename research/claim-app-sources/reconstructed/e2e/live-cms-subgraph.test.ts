import assert from "node:assert/strict";
import test from "node:test";

import { getAddress, isAddress, zeroAddress } from "viem";

import {
  buildClaimProgramPlan,
  fetchCmsBatches,
  getClaimResultKind,
} from "../client/claim-program-plan.ts";
import {
  getProgramStatus,
  getPublicPrograms,
  SUP_SUBGRAPH,
  type PublicProgram,
} from "../client/programs.ts";

const CMS_BASE = process.env.CMS_BASE_URL ?? "https://cms.superfluid.pro";
const FALLBACK_ACCOUNT =
  process.env.E2E_ACCOUNT ?? "0xdBb811EC62338db94858Ec21ef1d56B658111922";
const FALLBACK_CAMPAIGN_ID = Number(process.env.E2E_CAMPAIGN_ID ?? "608");
const DISCOVERY_LIMIT = Number(process.env.E2E_DISCOVERY_LIMIT ?? "40");
const REQUEST_TIMEOUT_MS = Number(process.env.E2E_REQUEST_TIMEOUT_MS ?? "15000");
const REQUEST_ATTEMPTS = Number(process.env.E2E_REQUEST_ATTEMPTS ?? "3");

interface CmsBatchResponse {
  address?: unknown;
  account?: unknown;
  campaignIds?: unknown;
  points?: unknown;
  cappedPoints?: unknown;
  warnings?: unknown;
}

interface CmsEventsResponse {
  events?: unknown;
  pagination?: unknown;
}

interface CmsBalanceResponse {
  address?: unknown;
  account?: unknown;
  points?: unknown;
  cappedPoints?: unknown;
}

interface NormalizedBatch {
  campaignIds: number[];
  points: number[];
  cappedPoints: number[];
  missingCampaignIds: Set<number>;
}

interface NormalizedBalance {
  account: string;
  points: number;
  cappedPoints: number;
}

interface NormalizedEvent {
  account: string;
  points: number;
  eventName: string;
  createdAt: string;
}

interface LiveSample {
  source: "cms-event" | "fallback-account";
  campaignId: number;
  account: string;
  balance: NormalizedBalance;
  event?: NormalizedEvent;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  options: { allowNotFound?: boolean } = {},
): Promise<T | undefined> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= REQUEST_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          accept: "application/json",
          ...init.headers,
        },
      });
      const text = await response.text();

      if (options.allowNotFound && response.status === 404) return undefined;
      if (!response.ok) {
        throw new Error(
          `${url} returned ${response.status}${text ? `: ${text.slice(0, 300)}` : ""}`,
        );
      }

      try {
        return JSON.parse(text) as T;
      } catch (error) {
        throw new Error(`${url} returned invalid JSON: ${errorMessage(error)}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt < REQUEST_ATTEMPTS) await sleep(250 * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const result = await fetchJson<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  assert(result !== undefined, `${url} unexpectedly returned no body`);
  return result;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), label);
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string): unknown[] {
  assert(Array.isArray(value), label);
  return value;
}

function asSafeInteger(value: unknown, label: string): number {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  assert(
    typeof parsed === "number" && Number.isSafeInteger(parsed),
    `${label} must be a safe integer; received ${String(value)}`,
  );
  return parsed;
}

function asAddress(value: unknown, label: string): string {
  assert(typeof value === "string" && isAddress(value), `${label} must be an EVM address`);
  return getAddress(value);
}

function assertDecimalString(value: unknown, label: string): bigint {
  assert(typeof value === "string" && /^\d+$/.test(value), `${label} must be decimal`);
  return BigInt(value);
}

function assertSubgraphProgramsSane(programs: readonly PublicProgram[]): void {
  assert(programs.length > 0, "SUP subgraph returned no programs");

  const ids = new Set<string>();
  let hasScheduledEnd = false;

  for (const program of programs) {
    assert.match(program.id, /^[1-9]\d*$/, "program.id must be a positive integer");
    assert(!ids.has(program.id), `SUP subgraph returned duplicate program ${program.id}`);
    ids.add(program.id);

    const pool = asAddress(
      program.distributionPool,
      `program ${program.id} distributionPool`,
    );
    assert.notEqual(pool, getAddress(zeroAddress), `program ${program.id} has zero pool`);

    assertDecimalString(program.fundingAmount, `program ${program.id} fundingAmount`);
    assertDecimalString(program.subsidyAmount, `program ${program.id} subsidyAmount`);
    const endDate = assertDecimalString(program.endDate, `program ${program.id} endDate`);
    if (endDate > 0n) hasScheduledEnd = true;

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

function normalizeBatch(
  payload: CmsBatchResponse,
  requestedCampaignIds: readonly number[],
  expectedAccount: string,
): NormalizedBatch {
  const record = asRecord(payload, "CMS batch response must be an object");
  const responseAccount = asAddress(
    record.address ?? record.account,
    "CMS batch response address",
  );
  assert.equal(responseAccount, getAddress(expectedAccount));

  const campaignIds = asArray(record.campaignIds, "campaignIds must be an array").map(
    (value, index) => asSafeInteger(value, `campaignIds[${index}]`),
  );
  const points = asArray(record.points, "points must be an array").map(
    (value, index) => asSafeInteger(value, `points[${index}]`),
  );
  const cappedPoints = asArray(
    record.cappedPoints,
    "cappedPoints must be an array",
  ).map((value, index) => asSafeInteger(value, `cappedPoints[${index}]`));

  assert.deepEqual(
    campaignIds,
    [...requestedCampaignIds],
    "CMS must preserve requested campaign ordering",
  );
  assert.equal(points.length, campaignIds.length, "points length must match IDs");
  assert.equal(
    cappedPoints.length,
    campaignIds.length,
    "cappedPoints length must match IDs",
  );

  const missingCampaignIds = new Set<number>();
  if (record.warnings !== undefined) {
    for (const [index, warningValue] of asArray(
      record.warnings,
      "warnings must be an array",
    ).entries()) {
      const warning = asRecord(warningValue, `warnings[${index}] must be an object`);
      const campaignId = asSafeInteger(
        warning.campaignId,
        `warnings[${index}].campaignId`,
      );
      assert(campaignIds.includes(campaignId), "warning campaign must be requested");
      assert(typeof warning.message === "string", "warning message must be a string");
      if (warning.message === "Campaign not found") missingCampaignIds.add(campaignId);
    }
  }

  return { campaignIds, points, cappedPoints, missingCampaignIds };
}

function normalizeBalance(payload: CmsBalanceResponse, expectedAccount: string): NormalizedBalance {
  const record = asRecord(payload, "CMS balance response must be an object");
  const account = asAddress(
    record.account ?? record.address,
    "CMS balance response account",
  );
  assert.equal(account, getAddress(expectedAccount));

  return {
    account,
    points: asSafeInteger(record.points, "CMS balance points"),
    cappedPoints: asSafeInteger(record.cappedPoints, "CMS balance cappedPoints"),
  };
}

function normalizeEvents(payload: CmsEventsResponse): NormalizedEvent[] {
  const record = asRecord(payload, "CMS events response must be an object");
  const events = asArray(record.events, "CMS events must be an array");
  const pagination = asRecord(record.pagination, "CMS pagination must be an object");

  assert(asSafeInteger(pagination.page, "pagination.page") >= 1);
  assert(asSafeInteger(pagination.limit, "pagination.limit") >= 1);
  assert(asSafeInteger(pagination.totalDocs, "pagination.totalDocs") >= 0);
  assert(asSafeInteger(pagination.totalPages, "pagination.totalPages") >= 0);

  return events.map((eventValue, index) => {
    const event = asRecord(eventValue, `events[${index}] must be an object`);
    const account = asAddress(event.account, `events[${index}].account`);
    const points = asSafeInteger(event.points, `events[${index}].points`);
    assert(
      typeof event.eventName === "string" && event.eventName.length > 0,
      `events[${index}].eventName must be non-empty`,
    );
    assert(
      typeof event.createdAt === "string" && Number.isFinite(Date.parse(event.createdAt)),
      `events[${index}].createdAt must be an ISO timestamp`,
    );

    return {
      account,
      points,
      eventName: event.eventName,
      createdAt: event.createdAt,
    };
  });
}

async function getSingleBalance(
  campaignId: number,
  account: string,
): Promise<NormalizedBalance> {
  const url = new URL(`${CMS_BASE}/points/balance`);
  url.searchParams.set("campaignId", String(campaignId));
  url.searchParams.set("account", account);
  const payload = await fetchJson<CmsBalanceResponse>(url.toString());
  assert(payload !== undefined, "CMS single balance unexpectedly returned no body");
  return normalizeBalance(payload, account);
}

async function discoverLiveSample(campaignIds: readonly number[]): Promise<LiveSample> {
  const candidates = [...campaignIds]
    .sort((left, right) => right - left)
    .slice(0, DISCOVERY_LIMIT);

  for (const campaignId of candidates) {
    const url = new URL(`${CMS_BASE}/points/events`);
    url.searchParams.set("campaignId", String(campaignId));
    url.searchParams.set("limit", "100");
    url.searchParams.set("page", "1");

    const payload = await fetchJson<CmsEventsResponse>(url.toString(), {}, {
      allowNotFound: true,
    });
    if (payload === undefined) continue;

    const events = normalizeEvents(payload);
    for (const event of events) {
      if (event.account === getAddress(zeroAddress) || event.points === 0) continue;
      const balance = await getSingleBalance(campaignId, event.account);
      if (balance.points !== 0 || balance.cappedPoints !== 0) {
        return {
          source: "cms-event",
          campaignId,
          account: event.account,
          balance,
          event,
        };
      }
    }
  }

  assert(
    campaignIds.includes(FALLBACK_CAMPAIGN_ID),
    `fallback campaign ${FALLBACK_CAMPAIGN_ID} is absent from the SUP subgraph`,
  );
  assert(isAddress(FALLBACK_ACCOUNT), "E2E_ACCOUNT fallback must be a valid address");

  return {
    source: "fallback-account",
    campaignId: FALLBACK_CAMPAIGN_ID,
    account: getAddress(FALLBACK_ACCOUNT),
    balance: await getSingleBalance(FALLBACK_CAMPAIGN_ID, FALLBACK_ACCOUNT),
  };
}

test(
  "live SUP subgraph and CMS produce a coherent claim sample",
  { timeout: 180_000 },
  async () => {
    const programs = await getPublicPrograms();
    assertSubgraphProgramsSane(programs);

    const plan = buildClaimProgramPlan(programs);
    assert.equal(plan.cmsCampaignIds.length, programs.length);
    assert(plan.cmsBatches.length > 0, "claim plan produced no CMS batches");
    assert(plan.cmsBatches.every((batch) => batch.length > 0 && batch.length <= 50));

    const existenceBatches = await fetchCmsBatches(plan.cmsBatches, async (campaignIds) =>
      normalizeBatch(
        await postJson<CmsBatchResponse>(`${CMS_BASE}/points/balance-batch`, {
          account: zeroAddress,
          campaignIds,
        }),
        campaignIds,
        zeroAddress,
      ),
    );

    const missingCampaignIds = new Set(
      existenceBatches.flatMap((batch) => [...batch.missingCampaignIds]),
    );
    const cmsCampaignIds = plan.cmsCampaignIds.filter(
      (campaignId) => !missingCampaignIds.has(campaignId),
    );
    assert(cmsCampaignIds.length > 0, "CMS and SUP subgraph have no overlapping campaigns");

    const sample = await discoverLiveSample(cmsCampaignIds);
    assert(
      sample.balance.points !== 0 || sample.balance.cappedPoints !== 0,
      `live sample ${sample.account} in campaign ${sample.campaignId} returned only zero balances`,
    );

    const accountBatches = await fetchCmsBatches(plan.cmsBatches, async (campaignIds) =>
      normalizeBatch(
        await postJson<CmsBatchResponse>(`${CMS_BASE}/points/balance-batch`, {
          account: sample.account,
          campaignIds,
        }),
        campaignIds,
        sample.account,
      ),
    );

    const flattenedIds = accountBatches.flatMap((batch) => batch.campaignIds);
    assert.deepEqual(flattenedIds, plan.cmsCampaignIds);

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
    assert.equal(
      resultKind,
      plan.comparablePrograms.length === 0 ? "no-active-programs" : "synchronized",
    );

    console.log(
      JSON.stringify(
        {
          cms: CMS_BASE,
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
