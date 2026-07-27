import { groupCmsEvents, type CmsEventLike } from "./event-groups";

export function GroupedEventList({
  events,
}: {
  events: readonly CmsEventLike[];
}) {
  const groups = groupCmsEvents(events);

  return (
    <div className="event-list">
      {groups.map((group) => (
        <div className="event-row" key={group.eventName}>
          <span>
            <strong title={group.eventName}>{group.displayName}</strong>
            <small>
              {group.count === 1
                ? new Date(group.latestCreatedAt).toLocaleString()
                : `${group.count} events · latest ${new Date(group.latestCreatedAt).toLocaleString()}`}
            </small>
          </span>
          <strong
            className={group.totalPoints < 0 ? "negative" : "positive"}
            title={`${group.count} event${group.count === 1 ? "" : "s"}`}
          >
            {group.totalPoints >= 0 ? "+" : ""}
            {group.totalPoints}
          </strong>
        </div>
      ))}
    </div>
  );
}
