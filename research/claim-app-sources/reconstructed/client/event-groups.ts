export interface CmsEventLike {
  id: number;
  eventName: string;
  points: number;
  createdAt: string;
}

export interface CmsEventGroup {
  key: string;
  displayName: string;
  count: number;
  totalPoints: number;
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
  if (!words[0]) return "event";
  return words
    .map((word) => INITIALISMS.get(word.toLowerCase()) ?? word.toLowerCase())
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
    const group = groups.get(family.key);
    if (!group) {
      groups.set(family.key, {
        ...family,
        count: 1,
        totalPoints: event.points,
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

  return [...groups.values()].sort(
    (left, right) =>
      timestamp(right.latestCreatedAt) - timestamp(left.latestCreatedAt) ||
      left.displayName.localeCompare(right.displayName),
  );
}
