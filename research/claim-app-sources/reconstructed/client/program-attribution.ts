export const CLAIM_PROGRAMS_ENDPOINT =
  "https://claim.superfluid.org/api/programs";

export interface CampaignAttribution {
  names: string[];
  descriptors: string[];
}

export type ProgramAttributions = ReadonlyMap<number, CampaignAttribution>;

interface ProgramAttributionSource {
  name?: unknown;
  category?: unknown;
  season?: unknown;
  program?: {
    id?: unknown;
  } | null;
}

function addUnique(values: string[], value: string) {
  if (!values.includes(value)) values.push(value);
}

export function buildProgramAttributions(
  sources: readonly ProgramAttributionSource[],
): Map<number, CampaignAttribution> {
  const attributions = new Map<number, CampaignAttribution>();

  for (const source of sources) {
    const programId = source.program?.id;
    const name = typeof source.name === "string" ? source.name.trim() : "";
    const category =
      typeof source.category === "string" ? source.category.trim() : "";
    const season =
      typeof source.season === "string" && source.season.trim()
        ? source.season.trim()
        : "—";

    if (
      typeof programId !== "number" ||
      !Number.isSafeInteger(programId) ||
      programId <= 0 ||
      !name ||
      !category
    ) {
      continue;
    }

    const attribution = attributions.get(programId) ?? {
      names: [],
      descriptors: [],
    };
    addUnique(attribution.names, name);
    addUnique(attribution.descriptors, `Season ${season} · ${category}`);
    attributions.set(programId, attribution);
  }

  return attributions;
}

export function mergeProgramAttributions(
  fallback: ProgramAttributions,
  live: ProgramAttributions,
): Map<number, CampaignAttribution> {
  return new Map([...fallback, ...live]);
}

export async function getPublicProgramAttributions(
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
): Promise<Map<number, CampaignAttribution>> {
  const response = await fetchImplementation(CLAIM_PROGRAMS_ENDPOINT, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Claim program metadata returned ${response.status}`);
  }

  const payload = (await response.json()) as { json?: unknown };
  if (!Array.isArray(payload.json)) {
    throw new Error("Claim program metadata returned a malformed payload.");
  }

  const attributions = buildProgramAttributions(
    payload.json as ProgramAttributionSource[],
  );
  if (attributions.size === 0 && payload.json.length > 0) {
    throw new Error("Claim program metadata contained no usable programs.");
  }
  return attributions;
}
