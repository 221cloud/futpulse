interface ApiFootballFixture {
  fixture: { id: number; date: string; status: { short: string } };
  league: { id: number; name: string; season: number };
  teams: {
    home: { id: number; name: string; logo?: string | null };
    away: { id: number; name: string; logo?: string | null };
  };
  goals: { home: number | null; away: number | null };
}
interface ApiFootballResponse {
  errors?: unknown;
  response?: ApiFootballFixture[];
}
export interface NormalizedFixture {
  id: string;
  competitionId: string;
  competitionName: string;
  season: string;
  kickoffAt: string | null;
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled" | "unknown";
  homeTeam: { id: string; name: string; logoUrl: string | null };
  awayTeam: { id: string; name: string; logoUrl: string | null };
  homeScore: number | null;
  awayScore: number | null;
  updatedAt: string;
  source: "api-football";
}
function normalizeStatus(short: string): NormalizedFixture["status"] {
  if (["NS", "TBD"].includes(short)) return "scheduled";
  if (["1H", "HT", "2H", "ET", "P", "LIVE", "BT"].includes(short)) return "live";
  if (["FT", "AET", "PEN"].includes(short)) return "finished";
  if (["PST", "SUSP", "INT"].includes(short)) return "postponed";
  if (["CANC", "ABD", "AWD", "WO"].includes(short)) return "cancelled";
  return "unknown";
}
export function normalizeFixtures(items: ApiFootballFixture[]): NormalizedFixture[] {
  const updatedAt = new Date().toISOString();
  return items.map((item) => ({
    id: String(item.fixture.id),
    competitionId: String(item.league.id),
    competitionName: item.league.name,
    season: String(item.league.season),
    kickoffAt: item.fixture.date || null,
    status: normalizeStatus(item.fixture.status.short),
    homeTeam: { id: String(item.teams.home.id), name: item.teams.home.name, logoUrl: item.teams.home.logo ?? null },
    awayTeam: { id: String(item.teams.away.id), name: item.teams.away.name, logoUrl: item.teams.away.logo ?? null },
    homeScore: item.goals.home,
    awayScore: item.goals.away,
    updatedAt,
    source: "api-football"
  }));
}
export async function fetchApiFootballFixtures(apiKey: string, params: URLSearchParams): Promise<NormalizedFixture[]> {
  const providerUrl = new URL("https://v3.football.api-sports.io/fixtures");
  for (const key of ["date", "league", "season", "team", "last", "next"]) {
    const value = params.get(key);
    if (value) providerUrl.searchParams.set(key, value);
  }
  const response = await fetch(providerUrl.toString(), { headers: { "x-apisports-key": apiKey } });
  if (!response.ok) throw new Error(`api_football_http_${response.status}`);
  const payload = await response.json() as ApiFootballResponse;
  if (payload.errors && Object.keys(payload.errors as object).length > 0) throw new Error("api_football_provider_error");
  return normalizeFixtures(payload.response ?? []);
}

export interface FixtureDetails {
  lineups: unknown[];
  statistics: unknown[];
  events: unknown[];
  availability: { lineups: boolean; statistics: boolean; events: boolean };
}
async function fetchFixtureDetailResource(apiKey: string, endpoint: string, fixtureId: string): Promise<unknown[]> {
  const url = new URL(`https://v3.football.api-sports.io/${endpoint}`);
  url.searchParams.set("fixture", fixtureId);
  const response = await fetch(url.toString(), { headers: { "x-apisports-key": apiKey } });
  if (!response.ok) return [];
  const payload = await response.json() as { errors?: unknown; response?: unknown[] };
  if (payload.errors && Object.keys(payload.errors as object).length > 0) return [];
  return payload.response ?? [];
}
export async function fetchApiFootballFixtureDetails(apiKey: string, fixtureId: string): Promise<FixtureDetails> {
  const [lineups, statistics, events] = await Promise.all([
    fetchFixtureDetailResource(apiKey, "fixtures/lineups", fixtureId),
    fetchFixtureDetailResource(apiKey, "fixtures/statistics", fixtureId),
    fetchFixtureDetailResource(apiKey, "fixtures/events", fixtureId)
  ]);
  return {
    lineups, statistics, events,
    availability: {
      lineups: lineups.length > 0,
      statistics: statistics.length > 0,
      events: events.length > 0
    }
  };
}
