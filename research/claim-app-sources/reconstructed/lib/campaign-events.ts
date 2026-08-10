import {
  cmsClient,
  requireCmsData,
  type CmsClient,
  type CmsPointEvent,
} from "./cms-client";

export const CAMPAIGN_EVENT_PAGE_SIZE = 100;
export const CAMPAIGN_EVENT_PAGES_PER_LOAD = 3;
export const CAMPAIGN_EVENTS_PER_LOAD =
  CAMPAIGN_EVENT_PAGE_SIZE * CAMPAIGN_EVENT_PAGES_PER_LOAD;

export interface CampaignEventBatch {
  events: CmsPointEvent[];
  pagesFetched: number[];
  nextPage: number | null;
  totalEvents: number;
}

function requirePositiveSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer.`);
  }
  return value;
}

export async function getCampaignEventBatch(
  campaignId: number,
  startPage = 1,
  client: CmsClient = cmsClient,
): Promise<CampaignEventBatch> {
  requirePositiveSafeInteger(campaignId, "Campaign ID");
  let page = requirePositiveSafeInteger(startPage, "Campaign event page");
  const events: CmsPointEvent[] = [];
  const pagesFetched: number[] = [];
  let nextPage: number | null = page;
  let totalEvents = 0;

  for (let index = 0; index < CAMPAIGN_EVENT_PAGES_PER_LOAD; index += 1) {
    const result = await client.GET("/points/events", {
      params: {
        query: {
          campaignId,
          limit: CAMPAIGN_EVENT_PAGE_SIZE,
          page,
        },
      },
    });
    const data = requireCmsData("/points/events", result);
    events.push(...data.events);
    pagesFetched.push(data.pagination.page);
    totalEvents = data.pagination.totalDocs;

    if (!data.pagination.hasNextPage) {
      nextPage = null;
      break;
    }

    page = data.pagination.page + 1;
    nextPage = page;
  }

  return { events, pagesFetched, nextPage, totalEvents };
}
