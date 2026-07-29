import {
  cmsClient,
  requireCmsData,
  type CmsClient,
  type CmsPointEvent,
} from "./cms-client.ts";

const MAX_EVENTS_PER_PAGE = 100;

export interface CmsEventReconciliation {
  events: CmsPointEvent[];
  targetPoints: number;
  explainedPoints: number;
  matched: boolean;
  exhausted: boolean;
}

function requireSafePoints(points: number, label: string) {
  if (!Number.isSafeInteger(points)) {
    throw new Error(`${label} must be a safe integer.`);
  }
  return points;
}

export async function getCmsEventsForDelta(
  input: {
    account: string;
    campaignId: number;
    targetPoints: number;
    maxPages?: number;
  },
  client: CmsClient = cmsClient,
): Promise<CmsEventReconciliation> {
  const targetPoints = requireSafePoints(
    input.targetPoints,
    "CMS event reconciliation target",
  );
  const maxPages = input.maxPages ?? 100;
  if (!Number.isSafeInteger(maxPages) || maxPages < 1) {
    throw new Error("CMS event page limit must be a positive safe integer.");
  }
  if (targetPoints === 0) {
    return {
      events: [],
      targetPoints,
      explainedPoints: 0,
      matched: true,
      exhausted: false,
    };
  }

  const events: CmsPointEvent[] = [];
  let explainedPoints = 0;
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await client.GET("/points/events", {
      params: {
        query: {
          campaignId: input.campaignId,
          account: input.account,
          limit: MAX_EVENTS_PER_PAGE,
          page,
        },
      },
    });
    const data = requireCmsData("/points/events", result);
    for (const event of data.events) {
      explainedPoints += requireSafePoints(event.points, "CMS event points");
      events.push(event);
      if (explainedPoints === targetPoints) {
        return {
          events,
          targetPoints,
          explainedPoints,
          matched: true,
          exhausted: false,
        };
      }
    }

    if (!data.pagination.hasNextPage) {
      return {
        events,
        targetPoints,
        explainedPoints,
        matched: false,
        exhausted: true,
      };
    }
    if (page === maxPages) {
      throw new Error(`CMS events exceeded the ${maxPages}-page safety limit.`);
    }
  }

  return {
    events,
    targetPoints,
    explainedPoints,
    matched: false,
    exhausted: true,
  };
}
