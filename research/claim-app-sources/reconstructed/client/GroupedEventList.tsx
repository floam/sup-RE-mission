import { groupCmsEvents, type CmsEventLike } from "./event-groups";

const numberFormat = new Intl.NumberFormat("en-US");

function formatPoints(points: number): string {
  return `${points >= 0 ? "+" : "−"}${numberFormat.format(Math.abs(points))}`;
}

export function GroupedEventList({
  events,
}: {
  events: readonly CmsEventLike[];
}) {
  const groups = groupCmsEvents(events);

  return (
    <div className="event-lines" aria-label="Events comprising this update">
      {groups.map((group) => (
        <p className="event-line" key={group.key}>
          <span
            className={group.totalPoints < 0 ? "negative" : "positive"}
          >
            {formatPoints(group.totalPoints)}
          </span>{" "}
          <span className="event-name">
            {group.count > 1 ? `${numberFormat.format(group.count)}× ` : ""}
            {group.displayName}
          </span>
        </p>
      ))}
    </div>
  );
}
