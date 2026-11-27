import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFixtures } from "../src/providers/apiFootball";

function fixture(status: string) {
  return {
    fixture: { id: 1208099, date: "2024-10-19T11:30:00+00:00", status: { short: status } },
    league: { id: 39, name: "Premier League", season: 2024 },
    teams: {
      home: { id: 47, name: "Tottenham", logo: "https://example.com/home.png" },
      away: { id:  WestHamId, name: "West Ham", logo: null }
    },
    goals: { home: 4, away: 1 }
  };
}
const WestHamId = 48;

test("normalizes fixture identity, teams, scores and source", () => {
  const [result] = normalizeFixtures([fixture("FT")]);
  assert.equal(result.id, "1208099");
  assert.equal(result.competitionId, "39");
  assert.equal(result.competitionName, "Premier League");
  assert.equal(result.season, "2024");
  assert.equal(result.kickoffAt, "2024-10-19T11:30:00+00:00");
  assert.deepEqual(result.homeTeam, {
    id: "47",
    name: "Tottenham",
    logoUrl: "https://example.com/home.png"
  });
  assert.deepEqual(result.awayTeam, { id: "48", name: "West Ham", logoUrl: null });
  assert.equal(result.homeScore, 4);
  assert.equal(result.awayScore, 1);
  assert.equal(result.source, "api-football");
  assert.ok(Number.isFinite(Date.parse(result.updatedAt)));
});

test("maps provider statuses to FutPulse statuses", () => {
  const cases = [
    ["NS", "scheduled"],
    ["TBD", "scheduled"],
    ["1H", "live"],
    ["HT", "live"],
    ["2H", "live"],
    ["FT", "finished"],
    ["AET", "finished"],
    ["PEN", "finished"],
    ["PST", "postponed"],
    ["SUSP", "postponed"],
    ["CANC", "cancelled"],
    ["ABD", "cancelled"],
    ["UNKNOWN_PROVIDER_STATUS", "unknown"]
  ] as const;

  for (const [providerStatus, expectedStatus] of cases) {
    const [result] = normalizeFixtures([fixture(providerStatus)]);
    assert.equal(result.status, expectedStatus, `status ${providerStatus}`);
  }
});

test("returns an empty list when the provider returns no fixtures", () => {
  assert.deepEqual(normalizeFixtures([]), []);
});
