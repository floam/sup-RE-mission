import {
  cmsClient,
  requireCmsData,
  type CmsClient,
  type CmsPointEvent,
} from "./cms-client.ts";

const MAX_EVENTS_PER_PAGE = 100;

export async function getCmsEventsSince(
  input: {
    account: string;
    campaignId: number;
    startTime: string;
    maxPages?: number;
  },
  client: CmsClient = cmsClient,
) {
  const boundary = Date.parse(input.startTime);
  if (!Number.isFinite(boundary)) {
    throw new Error("CMS event boundary must be a valid timestamp.");
  }

  const maxPages = input.maxPages ?? 100;
  if (!Number.isSafeInteger(maxPages) || maxPages < 1) {
    throw new Error("CMS event page limit must be a positive safe integer.");
  }

  const events: CmsPointEvent[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await client.GET("/points/events", {
      params: {
        query: {
          campaignId: input.campaignId,
          account: input.account,
          startTime: input.startTime,
          limit: MAX_EVENTS_PER_PAGE,
          page,
        },
      },
    });
    const data = requireCmsData("/points/events", result);
    events.push(
      ...data.events.filter((event) => Date.parse(event.createdAt) > boundary),
    );
    if (!data.pagination.hasNextPage) return events;
    if (page === maxPages) {
      throw new Error(`CMS events exceeded the ${maxPages}-page safety limit.`);
    }
  }

  return events;
}
