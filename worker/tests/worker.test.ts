import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index";

test("GET /api/v1/football/fixtures returns normalized fixtures", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.match(String(input), /v3\.football\.api-sports\.io\/fixtures\?league=39&season=2024/);
    assert.equal(new Headers(init?.headers).get("x-apisports-key"), "test-key");
    return new Response(JSON.stringify({
      errors: {},
      response: [{
        fixture: { id: 1208099, date: "2024-10-19T11:30:00+00:00", status: { short: "FT" } },
        league: { id: 39, name: "Premier League", season: 2024 },
        teams: {
          home: { id: 47, name: "Tottenham", logo: null },
          away: { id: 48, name: "West Ham", logo: null }
        },
        goals: { home: 4, away: 1 }
      }]
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const request = new Request("https://futpulse.test/api/v1/football/fixtures?league=39&season=2024");
    const response = await worker.fetch(request, { API_FOOTBALL_KEY: "test-key" });
    assert.equal(response.status, 200);
    const body = await response.json() as {
      data: Array<{ id: string; status: string; homeScore: number; awayScore: number; source: string; competitionName: string }>;
      stale: boolean;
    };
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].id, "1208099");
    assert.equal(body.data[0].status, "finished");
    assert.equal(body.data[0].homeScore, 4);
    assert.equal(body.data[0].awayScore, 1);
    assert.equal(body.data[0].source, "api-football");
    assert.equal(body.data[0].competitionName, "Premier League");
    assert.equal(body.stale, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fixtures endpoint refuses requests when provider secret is missing", async () => {
  const request = new Request("https://futpulse.test/api/v1/football/fixtures");
  const response = await worker.fetch(request, {});
  assert.equal(response.status, 503);
  const body = await response.json() as { error: string };
  assert.equal(body.error, "provider_not_configured");
});
