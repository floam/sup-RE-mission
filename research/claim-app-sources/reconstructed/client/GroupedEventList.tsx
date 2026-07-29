import { groupCmsEvents, type CmsEventLike } from "./event-groups";

const numberFormat = new Intl.NumberFormat("en-US");
const monthFormat = new Intl.DateTimeFormat("en-US", { month: "short" });

function formatPoints(points: number): string {
  return `${points >= 0 ? "+" : ""}${numberFormat.format(points)} pts`;
}

function sameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatDateRange(firstValue: string, latestValue: string): string {
  const first = new Date(firstValue);
  const latest = new Date(latestValue);
  if (!Number.isFinite(first.getTime()) || !Number.isFinite(latest.getTime())) {
    return "Date unavailable";
  }

  const firstMonth = monthFormat.format(first);
  const latestMonth = monthFormat.format(latest);
  const firstDay = first.getDate();
  const latestDay = latest.getDate();
  const firstYear = first.getFullYear();
  const latestYear = latest.getFullYear();

  if (sameLocalDay(first, latest)) {
    return `${firstMonth} ${firstDay}, ${firstYear}`;
  }
  if (firstYear === latestYear && first.getMonth() === latest.getMonth()) {
    return `${firstMonth} ${firstDay}–${latestDay}, ${firstYear}`;
  }
  if (firstYear === latestYear) {
    return `${firstMonth} ${firstDay}–${latestMonth} ${latestDay}, ${firstYear}`;
  }
  return `${firstMonth} ${firstDay}, ${firstYear}–${latestMonth} ${latestDay}, ${latestYear}`;
}

export function GroupedEventList({
  events,
}: {
  events: readonly CmsEventLike[];
}) {
  const groups = groupCmsEvents(events);

  return (
    <div className="event-list">
      {groups.map((group) => (
        <div className="event-group" key={group.key}>
          <div className="event-group-summary">
            <span>
              <strong className="event-equation">
                <span>{numberFormat.format(group.count)}</span>
                <span aria-hidden="true">×</span>
                <span>{group.displayName}</span>
              </strong>
              <small>
                {formatDateRange(group.firstCreatedAt, group.latestCreatedAt)}
              </small>
            </span>
            <strong className={group.totalPoints < 0 ? "negative" : "positive"}>
              <span className="event-equals" aria-hidden="true">=</span>{" "}
              {formatPoints(group.totalPoints)}
            </strong>
          </div>
        </div>
      ))}
    </div>
  );
}
