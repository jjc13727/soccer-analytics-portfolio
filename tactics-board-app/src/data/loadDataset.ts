import type { ClubSquad, ClubSquadIndex, DatasetIndex, NormalizedMatch } from "./types";

const seasonCache = new Map<string, Promise<NormalizedMatch[]>>();
let indexCache: Promise<DatasetIndex> | null = null;
let squadIndexCache: Promise<ClubSquadIndex> | null = null;
const squadCache = new Map<string, Promise<ClubSquad>>();

// Vite serves /public at the site root, and BASE_URL handles being hosted under a
// sub-path (e.g. GitHub Pages) or loaded from file:// inside a packaged Electron app.
function dataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}data/${path}`;
}

export function loadIndex(): Promise<DatasetIndex> {
  if (!indexCache) {
    indexCache = fetch(dataUrl("index.json")).then((r) => {
      if (!r.ok) throw new Error(`Failed to load dataset index (${r.status})`);
      return r.json();
    });
  }
  return indexCache;
}

export function loadSeason(competitionId: number, seasonId: number): Promise<NormalizedMatch[]> {
  const key = `${competitionId}_${seasonId}`;
  if (!seasonCache.has(key)) {
    seasonCache.set(
      key,
      fetch(dataUrl(`matches/${key}.json`)).then((r) => {
        if (!r.ok) throw new Error(`Failed to load season ${key} (${r.status})`);
        return r.json();
      })
    );
  }
  return seasonCache.get(key)!;
}

export async function loadMatch(
  competitionId: number,
  seasonId: number,
  matchId: number
): Promise<NormalizedMatch | undefined> {
  const season = await loadSeason(competitionId, seasonId);
  return season.find((m) => m.match_id === matchId);
}

export function loadSquadIndex(): Promise<ClubSquadIndex> {
  if (!squadIndexCache) {
    squadIndexCache = fetch(dataUrl("squads/index.json")).then((r) => {
      if (!r.ok) throw new Error(`Failed to load club squad index (${r.status})`);
      return r.json();
    });
  }
  return squadIndexCache;
}

export function loadSquad(slug: string): Promise<ClubSquad> {
  if (!squadCache.has(slug)) {
    squadCache.set(
      slug,
      fetch(dataUrl(`squads/${slug}.json`)).then((r) => {
        if (!r.ok) throw new Error(`Failed to load squad "${slug}" (${r.status})`);
        return r.json();
      })
    );
  }
  return squadCache.get(slug)!;
}
