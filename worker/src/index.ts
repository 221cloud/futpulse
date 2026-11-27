import { fetchApiFootballFixtures } from "./providers/apiFootball";
export interface Env { APP_ORIGIN?: string; API_FOOTBALL_KEY?: string; }
const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data: unknown, status = 200, origin?: string): Response {
  const headers = new Headers(jsonHeaders);
  if (origin) headers.set("access-control-allow-origin", origin);
  headers.set("vary", "Origin");
  return new Response(JSON.stringify(data), { status, headers });
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestOrigin = request.headers.get("Origin") ?? "";
    const allowedOrigin = env.APP_ORIGIN ?? "";
    const corsOrigin = requestOrigin && requestOrigin === allowedOrigin ? allowedOrigin : undefined;
    if (request.method === "OPTIONS") {
      if (!corsOrigin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": corsOrigin,
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "Content-Type",
        "access-control-max-age": "86400", "vary": "Origin"
      }});
    }
    const url = new URL(request.url);
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, corsOrigin);
    if (url.pathname === "/api/health") return json({
      status: "ok", service: "futpulse-api",
      provider: env.API_FOOTBALL_KEY ? "configured" : "not_configured"
    }, 200, corsOrigin);
    if (url.pathname === "/api/v1/football/fixtures") {
      if (!env.API_FOOTBALL_KEY) return json({
        error: "provider_not_configured",
        message: "La clé API-Football n'est pas configurée côté serveur."
      }, 503, corsOrigin);
      const allowedParams = ["date", "league", "season", "team", "last", "next"];
      for (const key of url.searchParams.keys()) {
        // Ignore common analytics parameters added by browsers and link wrappers.
        if (key.startsWith("utm_") || key === "fbclid") continue;
        if (!allowedParams.includes(key)) return json({ error: "invalid_query_parameter", parameter: key }, 400, corsOrigin);
      }
      try {
        const data = await fetchApiFootballFixtures(env.API_FOOTBALL_KEY, url.searchParams);
        return json({ data, fetchedAt: new Date().toISOString(), stale: false }, 200, corsOrigin);
      } catch {
        return json({ error: "football_provider_unavailable", message: "Le fournisseur football est temporairement indisponible." }, 502, corsOrigin);
      }
    }
    return json({ error: "not_found" }, 404, corsOrigin);
  }
};
