import { useState } from "react";

import type { CmsPointEvent } from "../lib/cms-client";
import {
  CAMPAIGN_EVENT_LOAD_SIZE,
  loadCampaignEventHistory,
} from "../lib/campaign-event-history";
import { GroupedEventList } from "./GroupedEventList";

export function CampaignEventHistory({
  account,
  campaignId,
}: {
  account: string;
  campaignId: bigint;
}) {
  const [events, setEvents] = useState<CmsPointEvent[]>([]);
  const [nextPage, setNextPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalEvents, setTotalEvents] = useState<number>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadMore() {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    setError("");
    try {
      const result = await loadCampaignEventHistory({
        account,
        campaignId: Number(campaignId),
        page: nextPage,
      });
      setEvents((current) => [...current, ...result.events]);
      setNextPage(result.nextPage);
      setHasMore(result.hasMore);
      setTotalEvents(result.totalEvents);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : String(loadError),
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="campaign-history">
      {events.length > 0 && <GroupedEventList events={events} />}
      {error && (
        <p className="event-line">
          <span>!</span>
          <span className="event-name">{error}</span>
        </p>
      )}
      {hasMore ? (
        <button
          className="text-button"
          type="button"
          disabled={isLoading}
          onClick={() => void loadMore()}
        >
          {isLoading
            ? "loading history…"
            : events.length === 0
              ? `load up to ${CAMPAIGN_EVENT_LOAD_SIZE} recent events`
              : `load up to ${CAMPAIGN_EVENT_LOAD_SIZE} older events`}
        </button>
      ) : (
        <p className="event-line">
          <span>~</span>
          <span className="event-name">
            all {totalEvents ?? events.length} events loaded
          </span>
        </p>
      )}
    </div>
  );
}
