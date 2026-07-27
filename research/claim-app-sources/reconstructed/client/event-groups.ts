export interface CmsEventLike {
  id: number;
  eventName: string;
  points: number;
  createdAt: string;
}

export interface CmsEventGroup {
  eventName: string;
  displayName: string;
  count: number;
  totalPoints: number;
  latestCreatedAt: string;
}

const EVM_ADDRESS_PATTERN = /0x[a-fA-F0-9]{40}/g;

export function abbreviateEventName(eventName: string): string {
  return eventName.replace(
    EVM_ADDRESS_PATTERN,
    (address) => `${address.slice(0, 6)}…${address.slice(-4)}`,
  );
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function groupCmsEvents(
  events: readonly CmsEventLike[],
): CmsEventGroup[] {
  const groups = new Map<string, CmsEventGroup>();

  for (const event of events) {
    const existing = groups.get(event.eventName);
    if (!existing) {
      groups.set(event.eventName, {
        eventName: event.eventName,
        displayName: abbreviateEventName(event.eventName),
        count: 1,
        totalPoints: event.points,
        latestCreatedAt: event.createdAt,
      });
      continue;
    }

    existing.count += 1;
    existing.totalPoints += event.points;
    if (timestamp(event.createdAt) > timestamp(existing.latestCreatedAt)) {
      existing.latestCreatedAt = event.createdAt;
    }
  }

  return [...groups.values()].sort(
    (left, right) =>
      timestamp(right.latestCreatedAt) - timestamp(left.latestCreatedAt) ||
      left.eventName.localeCompare(right.eventName),
  );
}
