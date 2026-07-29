import { GroupedEventList } from "./GroupedEventList";
import type { PointState } from "./claim-chain";
import {
  formatList,
  formatMonthlyFlow,
  getCampaignAttribution,
} from "./claim-display";
import type { EventBreakdown } from "./claim-event-breakdown";

const numberFormat = new Intl.NumberFormat("en-US");

export function ClaimCampaignChange({
  row,
  breakdown,
  onToggleBreakdown,
}: {
  row: PointState;
  breakdown?: EventBreakdown;
  onToggleBreakdown(row: PointState): void;
}) {
  const attribution = getCampaignAttribution(row.programId);
  const unitDelta = row.offchainPoints - row.onchainPoints;
  const flowDelta = row.projectedFlowRate - row.currentFlowRate;
  const eventTotal = (breakdown?.events ?? []).reduce(
    (sum, event) => sum + event.points,
    0,
  );
  const eventsReconcile =
    Number.isSafeInteger(eventTotal) && BigInt(eventTotal) === unitDelta;

  const statusLabel = !row.cmsCampaignExists
    ? "Reward unavailable"
    : !row.isOnchainOutdated
      ? "Up to date"
      : flowDelta > 0n
        ? "Stream can grow"
        : unitDelta > 0n
          ? "More SUP earned"
          : "Reward changed";

  return (
    <article className="campaign-change">
      <header className="campaign-heading">
        <div>
          <h4>
            {attribution.names.length
              ? formatList(attribution.names)
              : `Campaign ${row.programId}`}
          </h4>
          <p className="campaign-meta">
            {attribution.descriptors.length
              ? `${attribution.descriptors.join(" / ")} · #${row.programId}`
              : `Campaign #${row.programId}`}
          </p>
        </div>
        <span
          className={
            !row.cmsCampaignExists
              ? "unavailable-pill"
              : row.isOnchainOutdated
                ? "update-pill"
                : "current-pill"
          }
        >
          {statusLabel}
        </span>
      </header>

      <div className="flow-comparison" aria-label="SUP stream comparison">
        <div>
          <span>Current stream</span>
          <strong>{formatMonthlyFlow(row.currentFlowRate)}</strong>
        </div>
        <div className="target">
          <span>After update</span>
          <strong>{formatMonthlyFlow(row.projectedFlowRate)}</strong>
        </div>
      </div>

      <div className="campaign-outcome">
        <span>Stream change</span>
        <strong className={flowDelta >= 0n ? "positive" : "negative"}>
          {formatMonthlyFlow(flowDelta, true)}
        </strong>
      </div>

      <div className="campaign-actions">
        <details className="technical-details">
          <summary>How this is calculated</summary>
          <p>
            Your Reserve changes from {numberFormat.format(row.onchainPoints)} to{" "}
            {numberFormat.format(row.offchainPoints)} units. The projected stream
            assumes the campaign pool&apos;s total flow is unchanged when the transaction
            executes; live pool changes can move the final rate slightly.
          </p>
        </details>
        {row.isOnchainOutdated && row.cmsCampaignExists && (
          <button
            className="text-button"
            type="button"
            aria-expanded={Boolean(breakdown)}
            onClick={() => onToggleBreakdown(row)}
          >
            {breakdown ? "Hide breakdown" : "Explain this update"}
          </button>
        )}
      </div>

      {breakdown && (
        <section className="event-drawer" aria-live="polite">
          <span className="eyebrow">Pending update</span>
          <h3>Newest events explaining this point difference</h3>
          <p className="muted">
            CMS returns events newest first. We include them one at a time until their
            net points equal the difference between the CMS target and your current
            onchain units.
          </p>
          {breakdown.events.length > 0 && (
            <>
              <GroupedEventList events={breakdown.events} />
              <p className="claim-reconciliation muted">
                {eventsReconcile
                  ? `${numberFormat.format(eventTotal)} CMS points exactly reconcile the ${numberFormat.format(unitDelta)}-unit update.`
                  : `${numberFormat.format(eventTotal)} of ${numberFormat.format(unitDelta)} pending points are explained by the available newest-event suffix.`}
              </p>
            </>
          )}
          {breakdown.events.length === 0 && (
            <p className="muted">
              No event suffix was returned for this point difference.
            </p>
          )}
        </section>
      )}
    </article>
  );
}
