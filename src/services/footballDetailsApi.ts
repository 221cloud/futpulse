export interface MatchPlayer {
  player?: { id?: number; name?: string; number?: number | null; pos?: string | null; grid?: string | null };
}
export interface MatchLineup {
  team?: { name?: string; logo?: string | null };
  formation?: string | null;
  startXI?: MatchPlayer[];
  substitutes?: MatchPlayer[];
}
export interface MatchStatistic {
  type?: string;
  value?: string | number | null;
}
export interface MatchTeamStatistics {
  team?: { name?: string };
  statistics?: MatchStatistic[];
}
export interface MatchEvent {
  time?: { elapsed?: number | null; extra?: number | null };
  team?: { name?: string };
  player?: { name?: string };
  assist?: { name?: string | null };
  type?: string;
  detail?: string;
}
export interface MatchDetailsData {
  lineups: MatchLineup[];
  statistics: MatchTeamStatistics[];
  events: MatchEvent[];
  availability: { lineups: boolean; statistics: boolean; events: boolean };
}
const API_BASE_URL = import.meta.env.VITE_FUTPULSE_API_URL?.replace(/\/$/, "") ?? "";
const detailsCache = new Map<number, Promise<MatchDetailsData>>();
export function getMatchDetails(fixtureId: number): Promise<MatchDetailsData> {
  const cached = detailsCache.get(fixtureId);
  if (cached) return cached;
  const request = fetch(
    `${API_BASE_URL}/api/v1/football/fixtures/${fixtureId}/details`,
    { headers: { Accept: "application/json" } }
  ).then(async (response) => {
    if (!response.ok) throw new Error("Impossible de charger les détails du match.");
    const payload = await response.json() as { data: MatchDetailsData };
    return payload.data;
  }).catch((error) => {
    detailsCache.delete(fixtureId);
    throw error;
  });
  detailsCache.set(fixtureId, request);
  return request;
}
