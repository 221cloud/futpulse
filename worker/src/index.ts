import { ApiFootballProviderError, fetchApiFootballFixtures, fetchApiFootballFixtureDetails } from "./providers/apiFootball";
import { handleAuth, type AuthEnv } from "./auth";
export interface Env extends AuthEnv { API_FOOTBALL_KEY?: string; }
const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const FIXTURE_DETAILS_CACHE_TTL_SECONDS = 10 * 60;
function json(data: unknown, status = 200, origin?: string): Response {
  const headers = new Headers(jsonHeaders);
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
  }
  headers.set("vary", "Origin");
  return new Response(JSON.stringify(data), { status, headers });
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestOrigin = request.headers.get("Origin") ?? "";
    const allowedOrigins = (env.APP_ORIGIN ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    const corsOrigin = requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : undefined;
    const url = new URL(request.url);
    const isAuthRoute = url.pathname.startsWith("/api/v1/auth/");
    if (request.method === "OPTIONS") {
      if (!corsOrigin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": corsOrigin,
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "Content-Type",
        "access-control-allow-credentials": "true",
        "access-control-max-age": "86400", "vary": "Origin"
      }});
    }
    if (isAuthRoute) {
      const publicEmailVerification = request.method === "GET" && url.pathname === "/api/v1/auth/verify";
      if (!corsOrigin && !publicEmailVerification) return json({ error: "origin_not_allowed" }, 403);
      try {
        const authResponse = await handleAuth(request, env, corsOrigin);
        if (authResponse) return authResponse;
      } catch (error) {
        console.error("Erreur inscription FutPulse :", error);
        return json({ error: "auth_service_unavailable" }, 500, corsOrigin);
      }
    }
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, corsOrigin);
    if (url.pathname === "/api/health") return json({
      status: "ok", service: "futpulse-api",
      provider: env.API_FOOTBALL_KEY ? "configured" : "not_configured",
      auth: env.DB ? "database_configured" : "not_configured"
    }, 200, corsOrigin);
    const detailsMatch = url.pathname.match(/^\/api\/v1\/football\/fixtures\/(\d+)\/details$/);
    if (detailsMatch) {
      if (!env.API_FOOTBALL_KEY) return json({
        error: "provider_not_configured",
        message: "La clé API-Football n'est pas configurée côté serveur."
      }, 503, corsOrigin);

      const fixtureId = detailsMatch[1];
      const now = Math.floor(Date.now() / 1000);
      let cached: { payload: string; fetched_at: number; expires_at: number } | null = null;

      if (env.DB) {
        try {
          cached = await env.DB.prepare(
            "SELECT payload, fetched_at, expires_at FROM football_fixture_details_cache WHERE fixture_id = ?"
          ).bind(fixtureId).first<{ payload: string; fetched_at: number; expires_at: number }>();
          if (cached && cached.expires_at > now) {
            return json({
              data: JSON.parse(cached.payload),
              fetchedAt: new Date(cached.fetched_at * 1000).toISOString(),
              cached: true,
              stale: false
            }, 200, corsOrigin);
          }
        } catch (error) {
          console.warn("Lecture du cache des détails de match impossible :", error);
          cached = null;
        }
      }

      try {
        const details = await fetchApiFootballFixtureDetails(env.API_FOOTBALL_KEY, fixtureId);
        const fetchedAt = Math.floor(Date.now() / 1000);
        if (env.DB) {
          try {
            await env.DB.prepare(
              `INSERT INTO football_fixture_details_cache (fixture_id, payload, fetched_at, expires_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(fixture_id) DO UPDATE SET
                 payload = excluded.payload,
                 fetched_at = excluded.fetched_at,
                 expires_at = excluded.expires_at`
            ).bind(
              fixtureId,
              JSON.stringify(details),
              fetchedAt,
              fetchedAt + FIXTURE_DETAILS_CACHE_TTL_SECONDS
            ).run();
          } catch (error) {
            console.warn("Enregistrement du cache des détails de match impossible :", error);
          }
        }
        return json({
          data: details,
          fetchedAt: new Date(fetchedAt * 1000).toISOString(),
          cached: false,
          stale: false
        }, 200, corsOrigin);
      } catch {
        if (cached) {
          return json({
            data: JSON.parse(cached.payload),
            fetchedAt: new Date(cached.fetched_at * 1000).toISOString(),
            cached: true,
            stale: true
          }, 200, corsOrigin);
        }
        return json({ error: "football_details_unavailable", message: "Les détails de cette rencontre sont temporairement indisponibles." }, 502, corsOrigin);
      }
    }
    if (url.pathname === "/api/v1/football/fixtures") {
      if (!env.API_FOOTBALL_KEY) return json({
        error: "provider_not_configured",
        message: "La clé API-Football n'est pas configurée côté serveur."
      }, 503, corsOrigin);
      const allowedParams = ["date", "league", "season", "team", "last", "next"];
      for (const key of url.searchParams.keys()) {
        if (key.startsWith("utm_") || key === "fbclid") continue;
        if (!allowedParams.includes(key)) return json({ error: "invalid_query_parameter", parameter: key }, 400, corsOrigin);
      }
      try {
        const providerData = await fetchApiFootballFixtures(env.API_FOOTBALL_KEY, url.searchParams);
        let manualData: typeof providerData = [];
        if (env.DB) {
          try {
            const manualResult = await env.DB.prepare(
              "SELECT id, competition_name, season, kickoff_at, home_team_name, away_team_name, status, home_score, away_score, updated_at FROM manual_football_fixtures ORDER BY kickoff_at DESC LIMIT 200"
            ).all<{
              id: string; competition_name: string; season: string; kickoff_at: string;
              home_team_name: string; away_team_name: string; status: string;
              home_score: number | null; away_score: number | null; updated_at: number;
            }>();
            manualData = (manualResult.results ?? []).map((fixture) => ({
              id: `manual-${fixture.id}`,
              competitionId: `manual-${fixture.competition_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
              competitionName: fixture.competition_name,
              season: fixture.season,
              kickoffAt: fixture.kickoff_at,
              status: fixture.status,
              homeTeam: { id: `manual-home-${fixture.id}`, name: fixture.home_team_name },
              awayTeam: { id: `manual-away-${fixture.id}`, name: fixture.away_team_name },
              homeScore: fixture.home_score,
              awayScore: fixture.away_score,
              updatedAt: new Date(fixture.updated_at * 1000).toISOString(),
              source: "manual"
            }));
          } catch (error) {
            console.warn("Lecture des rencontres manuelles impossible :", error);
          }
        }
        const normalize = (value: string) => value.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        const providerKeys = new Set(providerData.map((fixture) =>
          [normalize(fixture.homeTeam.name), normalize(fixture.awayTeam.name), fixture.kickoffAt?.slice(0, 10) ?? ""].join("|")
        ));
        const uniqueManualData = manualData.filter((fixture) =>
          !providerKeys.has([normalize(fixture.homeTeam.name), normalize(fixture.awayTeam.name), fixture.kickoffAt?.slice(0, 10) ?? ""].join("|"))
        );
        return json({
          data: [...providerData, ...uniqueManualData],
          fetchedAt: new Date().toISOString(),
          stale: false
        }, 200, corsOrigin);
      } catch (error) {
        if (error instanceof ApiFootballProviderError) {
          return json({
            error: "football_provider_unavailable",
            provider_status: error.providerStatus,
            provider_issue: error.providerIssue
          }, 502, corsOrigin);
        }
        return json({
          error: "football_provider_unavailable",
          provider_status: null,
          provider_issue: "unexpected_worker_error"
        }, 502, corsOrigin);
      }
    }
    return json({ error: "not_found" }, 404, corsOrigin);
  }
};
