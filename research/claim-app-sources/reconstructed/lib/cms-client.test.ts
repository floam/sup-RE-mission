import assert from "node:assert/strict";
import test from "node:test";

import {
  createCmsClient,
  requireCmsData,
  requireCmsSignature,
} from "./cms-client.ts";
import { getCmsEventsForDelta } from "./cms-events.ts";
import { loadCampaignEventHistory } from "./campaign-event-history.ts";

const ACCOUNT = "0xdBb811EC62338db94858Ec21ef1d56B658111922";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function captureFetch(
  handler: (request: Request, call: number) => Response | Promise<Response>,
) {
  const requests: Request[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(request);
    return handler(request, requests.length);
  };
  return { fetch, requests };
}

test("loads no more than 300 campaign events per user batch", async () => {
  const { fetch, requests } = captureFetch((_request, call) =>
    json({
      events: Array.from({ length: 100 }, (_, index) => ({
        id: (call - 1) * 100 + index,
        eventName: "activity",
        account: ACCOUNT,
        points: 1,
        uniqueId: null,
        createdAt: "2026-01-07T12:00:00.000Z",
      })),
      pagination: {
        page: call,
        limit: 100,
        totalDocs: 400,
        totalPages: 4,
        hasNextPage: true,
        hasPrevPage: call > 1,
      },
    }),
  );
  const cms = createCmsClient({ origin: "https://cms.example", fetch });

  const result = await loadCampaignEventHistory(
    { account: ACCOUNT, campaignId: 608 },
    cms,
  );

  assert.equal(result.events.length, 300);
  assert.equal(result.nextPage, 4);
  assert.equal(result.hasMore, true);
  assert.equal(requests.length, 3);
});

test("uses the generated POST contract for campaign balances", async () => {
  const { fetch, requests } = captureFetch(() =>
    json({
      address: ACCOUNT.toLowerCase(),
      campaignIds: [608, 609],
      points: [12, 34],
      cappedPoints: [12, 1],
      warnings: [],
    }),
  );
  const cms = createCmsClient({ origin: "https://cms.example/", fetch });

  const result = requireCmsData(
    "/points/balance-batch",
    await cms.POST("/points/balance-batch", {
      body: { account: ACCOUNT, campaignIds: [608, 609] },
    }),
  );

  assert.deepEqual(result.cappedPoints, [12, 1]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://cms.example/points/balance-batch");
  assert.equal(requests[0].method, "POST");
  assert.deepEqual(await requests[0].json(), {
    account: ACCOUNT,
    campaignIds: [608, 609],
  });
});

test("surfaces typed CMS API errors", async () => {
  const { fetch } = captureFetch(() =>
    json({ message: "Campaign not found" }, 404),
  );
  const cms = createCmsClient({ origin: "https://cms.example", fetch });

  await assert.rejects(
    async () =>
      requireCmsData(
        "/points/balance",
        await cms.GET("/points/balance", {
          params: { query: { account: ACCOUNT, campaignId: 9999 } },
        }),
      ),
    /CMS \/points\/balance returned 404: Campaign not found/,
  );
});

test("rejects a malformed signed-balance signature", async () => {
  const { fetch } = captureFetch(() =>
    json({
      address: ACCOUNT.toLowerCase(),
      campaignIds: [608],
      points: [1],
      uncappedPoints: [1234],
      signatureTimestamp: 1783349043,
      signature: "not-hex",
      signer: "0xB96cb16370c8A9cE54e0d686b8770225a17c43ee",
    }),
  );
  const cms = createCmsClient({ origin: "https://cms.example", fetch });

  const signed = requireCmsData(
    "/points/signed-balance-batch",
    await cms.POST("/points/signed-balance-batch", {
      body: { account: ACCOUNT, campaignIds: [608] },
    }),
  );
  assert.throws(
    () => requireCmsSignature(signed.signature),
    /malformed signature/,
  );
});

test("stops at the newest-first prefix whose net points match the delta", async () => {
  const { fetch, requests } = captureFetch((_request, call) =>
    call === 1
      ? json({
          events: [
            {
              id: 1,
              eventName: "mint-0xabc",
              account: ACCOUNT,
              points: 20,
              uniqueId: null,
              createdAt: "2026-07-08T00:00:00.000Z",
            },
            {
              id: 2,
              eventName: "adjustment-0xdef",
              account: ACCOUNT,
              points: -15,
              uniqueId: null,
              createdAt: "2026-07-07T00:00:00.000Z",
            },
          ],
          pagination: {
            page: 1,
            limit: 100,
            totalDocs: 4,
            totalPages: 2,
            hasNextPage: true,
            hasPrevPage: false,
          },
        })
      : json({
          events: [
            {
              id: 3,
              eventName: "swap-0x123",
              account: ACCOUNT,
              points: 5,
              uniqueId: null,
              createdAt: "2026-07-06T00:00:00.000Z",
            },
            {
              id: 4,
              eventName: "older-0x456",
              account: ACCOUNT,
              points: 99,
              uniqueId: null,
              createdAt: "2026-07-05T00:00:00.000Z",
            },
          ],
          pagination: {
            page: 2,
            limit: 100,
            totalDocs: 4,
            totalPages: 2,
            hasNextPage: false,
            hasPrevPage: true,
          },
        }),
  );
  const cms = createCmsClient({ origin: "https://cms.example", fetch });

  const reconciliation = await getCmsEventsForDelta(
    {
      account: ACCOUNT,
      campaignId: 608,
      targetPoints: 10,
    },
    cms,
  );

  assert.equal(reconciliation.matched, true);
  assert.equal(reconciliation.explainedPoints, 10);
  assert.deepEqual(
    reconciliation.events.map((event) => event.id),
    [1, 2, 3],
  );
  assert.equal(requests.length, 2);
  const firstUrl = new URL(requests[0].url);
  const secondUrl = new URL(requests[1].url);
  assert.equal(firstUrl.searchParams.get("campaignId"), "608");
  assert.equal(firstUrl.searchParams.get("account"), ACCOUNT);
  assert.equal(firstUrl.searchParams.has("startTime"), false);
  assert.equal(firstUrl.searchParams.has("endTime"), false);
  assert.equal(firstUrl.searchParams.get("page"), "1");
  assert.equal(secondUrl.searchParams.get("page"), "2");
});

test("keeps boundary-second events and excludes events outside the nonce window", async () => {
  const startTime = "2026-07-06T14:44:03.000Z";
  const endTime = "2026-07-06T14:44:05.000Z";
  const { fetch, requests } = captureFetch(() =>
    json({
      events: [
        {
          id: 1,
          eventName: "after-window",
          account: ACCOUNT,
          points: 99,
          uniqueId: null,
          createdAt: "2026-07-06T14:44:06.000Z",
        },
        {
          id: 2,
          eventName: "upper-boundary",
          account: ACCOUNT,
          points: 20,
          uniqueId: null,
          createdAt: endTime,
        },
        {
          id: 3,
          eventName: "adjustment",
          account: ACCOUNT,
          points: -15,
          uniqueId: null,
          createdAt: "2026-07-06T14:44:04.000Z",
        },
        {
          id: 4,
          eventName: "lower-boundary",
          account: ACCOUNT,
          points: 5,
          uniqueId: null,
          createdAt: startTime,
        },
        {
          id: 5,
          eventName: "before-window",
          account: ACCOUNT,
          points: 99,
          uniqueId: null,
          createdAt: "2026-07-06T14:44:02.000Z",
        },
      ],
      pagination: {
        page: 1,
        limit: 100,
        totalDocs: 5,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    }),
  );
  const cms = createCmsClient({ origin: "https://cms.example", fetch });

  const reconciliation = await getCmsEventsForDelta(
    {
      account: ACCOUNT,
      campaignId: 608,
      targetPoints: 10,
      startTime,
      endTime,
    },
    cms,
  );

  assert.equal(reconciliation.matched, true);
  assert.deepEqual(
    reconciliation.events.map((event) => event.id),
    [2, 3, 4],
  );
  assert.equal(requests.length, 1);
  const requestUrl = new URL(requests[0].url);
  assert.equal(requestUrl.searchParams.get("startTime"), startTime);
  assert.equal(requestUrl.searchParams.get("endTime"), endTime);
});

test("returns an explicit partial reconciliation when history is exhausted", async () => {
  const { fetch } = captureFetch(() =>
    json({
      events: [
        {
          id: 1,
          eventName: "swap",
          account: ACCOUNT,
          points: 7,
          uniqueId: null,
          createdAt: "2026-07-08T00:00:00.000Z",
        },
      ],
      pagination: {
        page: 1,
        limit: 100,
        totalDocs: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    }),
  );
  const cms = createCmsClient({ origin: "https://cms.example", fetch });

  const reconciliation = await getCmsEventsForDelta(
    { account: ACCOUNT, campaignId: 608, targetPoints: 10 },
    cms,
  );

  assert.equal(reconciliation.matched, false);
  assert.equal(reconciliation.exhausted, true);
  assert.equal(reconciliation.explainedPoints, 7);
});
