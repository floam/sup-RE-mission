import assert from "node:assert/strict";
import test from "node:test";

import { getCampaignEventBatch } from "./campaign-events.ts";
import { createCmsClient } from "./cms-client.ts";

const ACCOUNT = "0xdBb811EC62338db94858Ec21ef1d56B658111922";

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function event(id: number) {
  return {
    id,
    eventName: `event-${id}`,
    account: ACCOUNT,
    points: id,
    uniqueId: null,
    createdAt: `2026-08-10T10:${String(id).padStart(2, "0")}:00.000Z`,
  };
}

test("loads at most three newest-first CMS pages per campaign action", async () => {
  const requestedPages: number[] = [];
  const cms = createCmsClient({
    origin: "https://cms.example",
    fetch: async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const page = Number(new URL(request.url).searchParams.get("page"));
      requestedPages.push(page);
      return json({
        events: [event(page)],
        pagination: {
          page,
          limit: 100,
          totalDocs: 500,
          totalPages: 5,
          hasNextPage: page < 5,
          hasPrevPage: page > 1,
        },
      });
    },
  });

  const batch = await getCampaignEventBatch(608, 1, cms);

  assert.deepEqual(requestedPages, [1, 2, 3]);
  assert.deepEqual(batch.pagesFetched, [1, 2, 3]);
  assert.deepEqual(batch.events.map((item) => item.id), [1, 2, 3]);
  assert.equal(batch.nextPage, 4);
  assert.equal(batch.totalEvents, 500);
});

test("stops when CMS reports the end of campaign history", async () => {
  const requestedPages: number[] = [];
  const cms = createCmsClient({
    origin: "https://cms.example",
    fetch: async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const page = Number(new URL(request.url).searchParams.get("page"));
      requestedPages.push(page);
      return json({
        events: [event(page)],
        pagination: {
          page,
          limit: 100,
          totalDocs: 2,
          totalPages: 2,
          hasNextPage: page < 2,
          hasPrevPage: page > 1,
        },
      });
    },
  });

  const batch = await getCampaignEventBatch(608, 1, cms);

  assert.deepEqual(requestedPages, [1, 2]);
  assert.equal(batch.nextPage, null);
  assert.equal(batch.events.length, 2);
});
