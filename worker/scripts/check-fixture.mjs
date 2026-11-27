#!/usr/bin/env node

// Read-only test: exactly one API-Football request for a known fixture.
// Never prints or persists the API key or account information.
const apiKey = process.env.API_FOOTBALL_KEY;

if (!apiKey) {
  console.error("Configuration manquante : API_FOOTBALL_KEY n'est pas disponible.");
  process.exit(1);
}

try {
  const url = new URL("https://v3.football.api-sports.io/fixtures");
  url.searchParams.set("id", "1208099");

  const response = await fetch(url, {
    headers: { "x-apisports-key": apiKey },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    console.error(`API-Football a répondu avec HTTP ${response.status}.`);
    process.exit(1);
  }

  const payload = await response.json();
  const errors = payload?.errors;
  const hasErrors = Array.isArray(errors)
    ? errors.length > 0
    : errors && typeof errors === "object"
      ? Object.keys(errors).length > 0
      : Boolean(errors);

  if (hasErrors) {
    console.error("Le fournisseur a signalé une erreur. Détail masqué.");
    process.exit(1);
  }

  const fixture = Array.isArray(payload?.response) ? payload.response[0] : null;
  if (!fixture?.fixture?.id) {
    console.log("Requête exécutée, mais aucun match trouvé pour l'identifiant de test.");
    console.log("Nombre de résultats :", Array.isArray(payload?.response) ? payload.response.length : 0);
    process.exit(0);
  }

  console.log("Test du match : OK");
  console.log("Identifiant :", fixture.fixture.id);
  console.log("Compétition :", fixture.league?.name ?? "Non renseignée");
  console.log("Saison :", fixture.league?.season ?? "Non renseignée");
  console.log("Date :", fixture.fixture?.date ?? "Non renseignée");
  console.log("Match :", `${fixture.teams?.home?.name ?? "?"} - ${fixture.teams?.away?.name ?? "?"}`);
  console.log("Score :", `${fixture.goals?.home ?? "-"} - ${fixture.goals?.away ?? "-"}`);
  console.log("Statut :", fixture.fixture?.status?.long ?? fixture.fixture?.status?.short ?? "Non renseigné");
  console.log("Aucune clé API ni donnée personnelle du compte n'a été affichée.");
} catch {
  console.error("Impossible de joindre API-Football (réseau, délai dépassé ou réponse invalide).");
  process.exit(1);
}
