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

function parseBoundary(value: string | undefined, label: string) {
  if (value === undefined) return undefined;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${label} must be a valid timestamp.`);
  }
  return timestamp;
}

export async function getCmsEventsForDelta(
  input: {
    account: string;
    campaignId: number;
    targetPoints: number;
    startTime?: string;
    endTime?: string;
    maxPages?: number;
  },
  client: CmsClient = cmsClient,
): Promise<CmsEventReconciliation> {
  const targetPoints = requireSafePoints(
    input.targetPoints,
    "CMS event reconciliation target",
  );
  const lowerBoundary = parseBoundary(input.startTime, "CMS event lower boundary");
  const upperBoundary = parseBoundary(input.endTime, "CMS event upper boundary");
  if (
    lowerBoundary !== undefined &&
    upperBoundary !== undefined &&
    lowerBoundary > upperBoundary
  ) {
    throw new Error("CMS event lower boundary must not exceed its upper boundary.");
  }

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
          startTime: input.startTime,
          endTime: input.endTime,
          limit: MAX_EVENTS_PER_PAGE,
          page,
        },
      },
    });
    const data = requireCmsData("/points/events", result);
    for (const event of data.events) {
      const eventTime = Date.parse(event.createdAt);
      if (!Number.isFinite(eventTime)) {
        throw new Error("CMS event createdAt must be a valid timestamp.");
      }
      // Nonces are second-resolution signed-balance snapshots. Keep events at the
      // boundary second and let exact delta reconciliation decide whether they belong.
      if (lowerBoundary !== undefined && eventTime < lowerBoundary) continue;
      if (upperBoundary !== undefined && eventTime > upperBoundary) continue;

      explainedPoints += requireSafePoints(event.points, "CMS event points");
      if (!Number.isSafeInteger(explainedPoints)) {
        throw new Error("CMS event reconciliation sum exceeds the safe integer range.");
      }
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
