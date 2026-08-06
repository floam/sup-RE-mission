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
  isSelected,
  isSelectionDisabled = false,
  onSelectionChange,
  breakdown,
  onToggleBreakdown,
}: {
  row: PointState;
  isSelected?: boolean;
  isSelectionDisabled?: boolean;
  onSelectionChange?(selected: boolean): void;
  breakdown?: EventBreakdown;
  onToggleBreakdown(row: PointState): void;
}) {
  const attribution = getCampaignAttribution(row.programId);
  const unitDelta = row.offchainPoints - row.onchainPoints;
  const uncappedDelta = row.uncappedPoints - row.onchainPoints;
  const flowDelta = row.projectedFlowRate - row.currentFlowRate;
  const eventTotal = (breakdown?.events ?? []).reduce(
    (sum, event) => sum + event.points,
    0,
  );
  const eventsReconcile =
    Number.isSafeInteger(eventTotal) && BigInt(eventTotal) === uncappedDelta;

  const statusLabel = !row.cmsCampaignExists
    ? "Reward unavailable"
    : row.isCapped
      ? "Capped out"
      : !row.isOnchainOutdated
        ? "Up to date"
        : flowDelta > 0n
          ? "Stream can grow"
          : unitDelta > 0n
            ? "More SUP earned"
            : "SUP share decreased";
  const campaignState = !row.cmsCampaignExists
    ? "is-unavailable"
    : row.isCapped
      ? "is-capped"
      : row.isOnchainOutdated
        ? "is-changed"
        : "is-current";

  return (
    <article
      className={`campaign-change ${campaignState}${isSelected ? " is-selected" : ""}`}
    >
      <header className="campaign-heading">
        {onSelectionChange && (
          <label className="campaign-selection">
            <input
              type="checkbox"
              checked={isSelected}
              disabled={isSelectionDisabled}
              onChange={(event) => onSelectionChange(event.target.checked)}
            />
            <span>Include in update</span>
          </label>
        )}
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
              : row.isCapped || row.isOnchainOutdated
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

      {row.isCapped && (
        <section className="event-drawer" aria-label="Campaign cap reached">
          <span className="eyebrow">cap reached</span>
          <h3>This campaign is capped out</h3>
          <p className="muted">
            CMS reports {numberFormat.format(row.uncappedPoints)} raw points and
            caps the claim target at {numberFormat.format(row.offchainPoints)}{" "}
            unit
            {row.offchainPoints === 1n ? "" : "s"}. Additional campaign activity
            will not increase this campaign&apos;s SUP stream.
          </p>
          {row.isOnchainOutdated && (
            <p className="muted">
              The pending transaction applies the capped target to your Reserve.
            </p>
          )}
        </section>
      )}

      <div className="campaign-actions">
        <details className="technical-details">
          <summary>How this is calculated</summary>
          <p>
            Your Reserve changes from {numberFormat.format(row.onchainPoints)}{" "}
            to {numberFormat.format(row.offchainPoints)}{" "}unit
            {row.offchainPoints === 1n ? "" : "s"}. The projected stream assumes
            the campaign pool&apos;s total flow is unchanged when the transaction
            executes; live pool changes can move the final rate slightly.
          </p>
          {row.isCapped && (
            <p>
              Raw CMS points: {numberFormat.format(row.uncappedPoints)}. Capped
              claim target: {numberFormat.format(row.offchainPoints)}.
            </p>
          )}
        </details>
        {!row.isCapped && row.isOnchainOutdated && row.cmsCampaignExists && (
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

      {breakdown && !row.isCapped && (
        <section className="event-drawer" aria-live="polite">
          <span className="eyebrow">event evidence</span>
          <h3>Newest events explaining this point difference</h3>
          <p className="muted">
            CMS returns events newest first. We include them one at a time until
            their net points equal the difference between the uncapped CMS
            balance and your current onchain units.
          </p>
          {breakdown.message && <p className="muted">{breakdown.message}</p>}
          {breakdown.events.length > 0 && (
            <>
              <GroupedEventList events={breakdown.events} />
              <p className="claim-reconciliation muted">
                {eventsReconcile
                  ? `${numberFormat.format(eventTotal)} CMS points exactly reconcile the ${numberFormat.format(uncappedDelta)}-point difference.`
                  : `${numberFormat.format(eventTotal)} of ${numberFormat.format(uncappedDelta)} pending points are explained by the available newest-first prefix.`}
              </p>
            </>
          )}
        </section>
      )}
    </article>
  );
}
