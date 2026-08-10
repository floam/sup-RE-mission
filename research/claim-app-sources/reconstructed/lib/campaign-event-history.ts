import {
  cmsClient,
  requireCmsData,
  type CmsClient,
  type CmsPointEvent,
} from "./cms-client.ts";

export const CAMPAIGN_EVENT_LOAD_SIZE = 300;
const CMS_EVENT_PAGE_SIZE = 100;

export interface CampaignEventHistoryPage {
  events: CmsPointEvent[];
  nextPage: number;
  hasMore: boolean;
  totalEvents: number;
}

/** Load one user-visible history batch. The CMS limits each request to 100 rows. */
export async function loadCampaignEventHistory(
  input: { account: string; campaignId: number; page?: number },
  client: CmsClient = cmsClient,
): Promise<CampaignEventHistoryPage> {
  const firstPage = input.page ?? 1;
  if (!Number.isSafeInteger(firstPage) || firstPage < 1) {
    throw new Error("CMS event page must be a positive safe integer.");
  }

  const events: CmsPointEvent[] = [];
  let page = firstPage;
  let hasMore = false;
  let totalEvents = 0;
  for (let request = 0; request < 3; request += 1) {
    const result = await client.GET("/points/events", {
      params: {
        query: {
          account: input.account,
          campaignId: input.campaignId,
          limit: CMS_EVENT_PAGE_SIZE,
          page,
        },
      },
    });
    const data = requireCmsData("/points/events", result);
    events.push(...data.events);
    totalEvents = data.pagination.totalDocs;
    hasMore = data.pagination.hasNextPage;
    page += 1;
    if (!hasMore) break;
  }

  return { events, nextPage: page, hasMore, totalEvents };
}
