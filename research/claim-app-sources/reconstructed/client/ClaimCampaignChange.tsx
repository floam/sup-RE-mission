import { useState } from "react";

import { CampaignEventHistory } from "./CampaignEventHistory";
import { GroupedEventList } from "./GroupedEventList";
import type { PointState } from "./claim-chain";
import {
  formatCompactMonthlyFlow,
  formatList,
  getCampaignAttribution,
} from "./claim-display";
import type { EventBreakdown } from "./claim-event-breakdown";
import type { ProgramAttributions } from "./program-attribution";

const numberFormat = new Intl.NumberFormat("en-US");
const compactNumberFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function formatSignedPoints(value: bigint) {
  if (value > 0n) return `+${numberFormat.format(value)}`;
  if (value < 0n) return `−${numberFormat.format(-value)}`;
  return "0";
}

function signedClass(value: bigint) {
  if (value > 0n) return "positive";
  if (value < 0n) return "negative";
  return undefined;
}

function formatProjectedShare(row: PointState) {
  const projectedTotalUnits =
    row.poolTotalUnits - row.onchainPoints + row.offchainPoints;
  if (projectedTotalUnits <= 0n || row.offchainPoints <= 0n) {
    return "0% projected pool share";
  }

  const hundredths = (row.offchainPoints * 10_000n) / projectedTotalUnits;
  if (hundredths === 0n) return "<0.01% projected pool share";

  const whole = hundredths / 100n;
  const fraction = (hundredths % 100n).toString().padStart(2, "0");
  const compactFraction = fraction.replace(/0+$/, "");
  return `${whole}${compactFraction ? `.${compactFraction}` : ""}% projected pool share`;
}

export function ClaimCampaignChange({
  row,
  attributions,
  isSelected,
  isSelectionDisabled = false,
  onSelectionChange,
  breakdown,
  account,
  onExplain,
}: {
  row: PointState;
  attributions?: ProgramAttributions;
  isSelected?: boolean;
  isSelectionDisabled?: boolean;
  onSelectionChange?(selected: boolean): void;
  breakdown?: EventBreakdown;
  account: string;
  onExplain?(): void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const attribution = getCampaignAttribution(row.programId, attributions);
  const unitDelta = row.offchainPoints - row.onchainPoints;
  const flowDelta = row.projectedFlowRate - row.currentFlowRate;
  const campaignName = attribution.names.length
    ? formatList(attribution.names)
    : `Campaign ${row.programId}`;

  return (
    <article className="campaign-change">
      {onSelectionChange ? (
        <label className="campaign-heading">
          <input
            className="campaign-checkbox"
            type="checkbox"
            checked={isSelected}
            disabled={isSelectionDisabled}
            onChange={(event) => onSelectionChange(event.target.checked)}
          />
          <span className="campaign-check" aria-hidden="true">
            {isSelected ? "[✓]" : "[ ]"}
          </span>{" "}
          <strong className="campaign-name">{campaignName}</strong>
        </label>
      ) : (
        <p className="campaign-heading">
          <span className="campaign-check" aria-hidden="true">
            [-]
          </span>{" "}
          <strong className="campaign-name">{campaignName}</strong>
        </p>
      )}

      <p className="campaign-metrics">
        <span>
          pts{" "}
          <strong className={signedClass(unitDelta)}>
            {formatSignedPoints(unitDelta)}
          </strong>
        </span>
        <span>
          flow{" "}
          <strong className={signedClass(flowDelta)}>
            {formatCompactMonthlyFlow(flowDelta, true)}
          </strong>
        </span>
      </p>

      {row.isCapped ? (
        <p className="event-line">
          <span>~</span>
          <span className="event-name">
            cap {compactNumberFormat.format(row.uncappedPoints)} raw →{" "}
            {numberFormat.format(row.offchainPoints)} unit
            {row.offchainPoints === 1n ? "" : "s"}
          </span>
        </p>
      ) : breakdown?.events.length ? (
        <>
          <GroupedEventList events={breakdown.events} />
          {breakdown.message && (
            <p className="event-line">
              <span>~</span>
              <span className="event-name">{breakdown.message}</span>
            </p>
          )}
        </>
      ) : breakdown?.message ? (
        <p className="event-line">
          <span>~</span>
          <span className="event-name">{breakdown.message}</span>
        </p>
      ) : row.isOnchainOutdated && row.cmsCampaignExists && onExplain ? (
        <button className="text-button" type="button" onClick={onExplain}>
          explain pending change
        </button>
      ) : null}

      {!row.cmsCampaignExists && (
        <p className="event-line">
          <span>!</span>
          <span className="event-name">
            campaign unavailable from points API
          </span>
        </p>
      )}

      <p className="campaign-standing">{formatProjectedShare(row)}</p>
      {row.cmsCampaignExists && (
        <>
          <button
            className="text-button"
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
          >
            {detailsOpen ? "hide campaign history" : "view campaign history"}
          </button>
          {detailsOpen && (
            <CampaignEventHistory
              account={account}
              campaignId={row.programId}
            />
          )}
        </>
      )}
    </article>
  );
}
