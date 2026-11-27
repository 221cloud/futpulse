import { ApiFootballProviderError, fetchApiFootballFixtures, fetchApiFootballFixtureDetails } from "./providers/apiFootball";
import { handleAuth, type AuthEnv } from "./auth";
export interface Env extends AuthEnv { API_FOOTBALL_KEY?: string; }
const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
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
      if (!corsOrigin) return json({ error: "origin_not_allowed" }, 403);
      try {
        const authResponse = await handleAuth(request, env, corsOrigin);
        if (authResponse) return authResponse;
      } catch {
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
      try {
        const details = await fetchApiFootballFixtureDetails(env.API_FOOTBALL_KEY, detailsMatch[1]);
        return json({ data: details, fetchedAt: new Date().toISOString() }, 200, corsOrigin);
      } catch {
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
        const data = await fetchApiFootballFixtures(env.API_FOOTBALL_KEY, url.searchParams);
        return json({ data, fetchedAt: new Date().toISOString(), stale: false }, 200, corsOrigin);
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
