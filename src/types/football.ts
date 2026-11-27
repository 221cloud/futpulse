export type FixtureStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled"
  | "unknown";

export interface FootballTeam {
  id: string;
  name: string;
  logoUrl?: string | null;
}

export interface FootballFixture {
  id: string;
  competitionId: string;
  competitionName: string;
  season: string;
  kickoffAt: string | null;
  status: FixtureStatus;
  homeTeam: FootballTeam;
  awayTeam: FootballTeam;
  homeScore: number | null;
  awayScore: number | null;
  updatedAt: string;
  source: string;
}

export interface FootballFixturesResponse {
  data: FootballFixture[];
  fetchedAt: string;
  stale: boolean;
}
