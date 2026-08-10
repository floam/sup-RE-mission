"use client";

import { useState } from "react";

import {
  CAMPAIGN_EVENTS_PER_LOAD,
  getCampaignEventBatch,
} from "../lib/campaign-events";
import type { CmsPointEvent } from "../lib/cms-client";
import styles from "./Campaigns.module.css";

function formatPoints(points: number) {
  return `${points > 0 ? "+" : ""}${new Intl.NumberFormat("en-US").format(points)}`;
}

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function CampaignEventHistory({ campaignId }: { campaignId: number }) {
  const [events, setEvents] = useState<CmsPointEvent[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(1);
  const [totalEvents, setTotalEvents] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(startPage: number, replace: boolean) {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const batch = await getCampaignEventBatch(campaignId, startPage);
      setEvents((current) => (replace ? batch.events : [...current, ...batch.events]));
      setNextPage(batch.nextPage);
      setTotalEvents(batch.totalEvents);
      setLoaded(true);
    } catch (reason) {
      setError(String(reason));
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <details
      className={styles.eventDetails}
      onToggle={(event) => {
        if (event.currentTarget.open && !loaded && !loading) {
          void load(1, true);
        }
      }}
    >
      <summary>events</summary>
      <div className={styles.eventHistory}>
        {loading && events.length === 0 && <p className="dim">loading newest events…</p>}
        {error && <p className="status warning">{error}</p>}
        {loaded && !error && (
          <p className="dim">
            {events.length} loaded
            {totalEvents === null ? "" : ` of ${new Intl.NumberFormat("en-US").format(totalEvents)}`}
            {nextPage === null ? " · end of history" : " · newest first"}
          </p>
        )}

        {events.length > 0 && (
          <div className={styles.eventTableWrap}>
            <table className={styles.eventTable}>
              <thead>
                <tr>
                  <th>time</th>
                  <th>points</th>
                  <th>event</th>
                  <th>account</th>
                  <th>unique ID</th>
                </tr>
              </thead>
              <tbody>
                {events.map((item) => (
                  <tr key={item.id}>
                    <td>{item.createdAt}</td>
                    <td className={styles.eventPoints}>{formatPoints(item.points)}</td>
                    <td>{item.eventName}</td>
                    <td title={item.account}>{shortAddress(item.account)}</td>
                    <td className={styles.eventUnique}>{item.uniqueId || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {nextPage !== null && loaded && !error && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void load(nextPage, false)}
          >
            {loading ? "loading…" : `load up to ${CAMPAIGN_EVENTS_PER_LOAD} more`}
          </button>
        )}
      </div>
    </details>
  );
}
