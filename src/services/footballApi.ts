import type { FootballFixturesResponse } from "../types/football";

const API_BASE_URL = import.meta.env.VITE_FUTPULSE_API_URL?.replace(/\/$/, "");

export class FootballApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "FootballApiError";
  }
}

export async function getFootballFixtures(): Promise<FootballFixturesResponse> {
  if (!API_BASE_URL) {
    throw new FootballApiError(
      "Le service FutPulse n'est pas encore configuré.",
      0
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/api/v1/football/fixtures`,
    { headers: { Accept: "application/json" } }
  );

  if (!response.ok) {
    let message = "Impossible de récupérer les rencontres.";
    try {
      const body = await response.json() as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      // Keep the default message when the response is not JSON.
    }
    throw new FootballApiError(message, response.status);
  }

  return response.json() as Promise<FootballFixturesResponse>;
}
