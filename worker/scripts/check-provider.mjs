#!/usr/bin/env node

// Manual, read-only credential check. Never prints or persists the API key.
const apiKey = process.env.API_FOOTBALL_KEY;

if (!apiKey) {
  console.error("Configuration manquante : définis API_FOOTBALL_KEY dans l'environnement local.");
  process.exit(1);
}

try {
  const response = await fetch("https://v3.football.api-sports.io/status", {
    headers: { "x-apisports-key": apiKey },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    console.error(`API-Football a répondu avec HTTP ${response.status}. Vérifie la clé et ton accès fournisseur.`);
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
    console.error("API-Football a rejeté la requête ou signale une erreur de compte. Détail masqué pour protéger les informations du compte.");
    process.exit(1);
  }

  const accountActive = payload?.response?.subscription?.active;
  if (accountActive !== true) {
    console.error("La clé a répondu, mais l'abonnement API-Football n'est pas confirmé comme actif.");
    process.exit(1);
  }

  const requests = payload?.response?.requests;
  const current = Number.isFinite(requests?.current) ? requests.current : null;
  const dailyLimit = Number.isFinite(requests?.limit_day) ? requests.limit_day : null;

  console.log("Connexion API-Football : OK");
  console.log("Abonnement : actif");
  if (current !== null && dailyLimit !== null) {
    console.log(`Requêtes utilisées aujourd'hui : ${current}/${dailyLimit}`);
  }
  console.log("Aucune donnée personnelle du compte ni aucune clé n'a été affichée.");
} catch {
  console.error("Impossible de joindre API-Football (réseau, délai dépassé ou réponse invalide).");
  process.exit(1);
}
