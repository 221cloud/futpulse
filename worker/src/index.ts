export interface Env {
  APP_ORIGIN?: string;
  API_FOOTBALL_KEY?: string;
}

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

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
    const corsOrigin = requestOrigin && requestOrigin === allowedOrigin
      ? allowedOrigin
      : undefined;

    if (request.method === "OPTIONS") {
      if (!corsOrigin) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": corsOrigin,
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "Content-Type",
          "access-control-max-age": "86400",
          "vary": "Origin"
        }
      });
    }

    const url = new URL(request.url);
    if (request.method !== "GET") {
      return json({ error: "method_not_allowed" }, 405, corsOrigin);
    }

    if (url.pathname === "/api/health") {
      return json({
        status: "ok",
        service: "futpulse-api",
        provider: "not_connected"
      }, 200, corsOrigin);
    }

    if (url.pathname === "/api/v1/football/fixtures") {
      return json({
        error: "provider_not_configured",
        message: "Le fournisseur football n'est pas encore connecté."
      }, 503, corsOrigin);
    }

    return json({ error: "not_found" }, 404, corsOrigin);
  }
};
