export interface CmsEventLike {
  id: number;
  eventName: string;
  points: number;
  createdAt: string;
}

export interface CmsEventGroup {
  key: string;
  familyKey: string;
  displayName: string;
  count: number;
  pointsPerEvent: number;
  totalPoints: number;
  canceled: boolean;
  firstCreatedAt: string;
  latestCreatedAt: string;
}

const TRAILING_IDENTIFIER_PATTERN =
  /^(.*?)(?:[-_:/\.\s]+)(0x[a-zA-Z0-9]{16,}|[a-zA-Z0-9]{16,})$/;
const INITIALISMS = new Map([
  ["nft", "NFT"],
  ["sup", "SUP"],
  ["lp", "LP"],
  ["dao", "DAO"],
]);

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function humanizeEventName(value: string) {
  const words = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean);
  if (!words[0]) return "Event";

  return words
    .map((word, index) => {
      const initialism = INITIALISMS.get(word.toLowerCase());
      if (initialism) return initialism;
      const normalized = word.toLowerCase();
      return index === 0
        ? normalized[0].toUpperCase() + normalized.slice(1)
        : normalized;
    })
    .join(" ");
}

export function getEventFamily(eventName: string) {
  const trimmed = eventName.trim().replace(/\s+/g, " ");
  const match = trimmed.match(TRAILING_IDENTIFIER_PATTERN);
  const familyName =
    match?.[1]?.replace(/[-_:/\.\s]+$/g, "").trim() || trimmed;

  return {
    key: familyName.toLowerCase(),
    displayName: humanizeEventName(familyName),
  };
}

export function groupCmsEvents(
  events: readonly CmsEventLike[],
): CmsEventGroup[] {
  const groups = new Map<string, CmsEventGroup>();

  for (const event of events) {
    const family = getEventFamily(event.eventName);
    const groupKey = JSON.stringify([family.key, event.points]);
    const group = groups.get(groupKey);
    if (!group) {
      groups.set(groupKey, {
        key: groupKey,
        familyKey: family.key,
        displayName: family.displayName,
        count: 1,
        pointsPerEvent: event.points,
        totalPoints: event.points,
        canceled: false,
        firstCreatedAt: event.createdAt,
        latestCreatedAt: event.createdAt,
      });
      continue;
    }

    group.count += 1;
    group.totalPoints += event.points;
    if (timestamp(event.createdAt) < timestamp(group.firstCreatedAt)) {
      group.firstCreatedAt = event.createdAt;
    }
    if (timestamp(event.createdAt) > timestamp(group.latestCreatedAt)) {
      group.latestCreatedAt = event.createdAt;
    }
  }

  const canceledCounts = new Map<string, number>();
  for (const group of groups.values()) {
    if (group.pointsPerEvent <= 0) continue;
    const opposite = groups.get(
      JSON.stringify([group.familyKey, -group.pointsPerEvent]),
    );
    if (opposite) {
      canceledCounts.set(group.key, Math.min(group.count, opposite.count));
    }
  }

  const displayGroups = [...groups.values()].flatMap((group) => {
    const pairKey = JSON.stringify([
      group.familyKey,
      Math.abs(group.pointsPerEvent),
    ]);
    const canceledCount = canceledCounts.get(pairKey) ?? 0;
    if (canceledCount === 0) return group;

    const remainderCount = group.count - canceledCount;
    const canceledGroup = {
      ...group,
      key: `${group.key}:canceled`,
      count: canceledCount,
      totalPoints: group.pointsPerEvent * canceledCount,
      canceled: true,
    };
    if (remainderCount === 0) return canceledGroup;
    return [
      {
        ...group,
        key: `${group.key}:active`,
        count: remainderCount,
        totalPoints: group.pointsPerEvent * remainderCount,
      },
      canceledGroup,
    ];
  });

  return displayGroups.sort(
    (left, right) => {
      if (
        left.familyKey === right.familyKey &&
        Math.abs(left.pointsPerEvent) === Math.abs(right.pointsPerEvent)
      ) {
        return (
          Number(left.canceled) - Number(right.canceled) ||
          right.pointsPerEvent - left.pointsPerEvent
        );
      }
      return (
        timestamp(right.latestCreatedAt) - timestamp(left.latestCreatedAt) ||
        left.displayName.localeCompare(right.displayName)
      );
    },
  );
}
