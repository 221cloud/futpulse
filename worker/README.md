# FutPulse API Worker

Service serveur indépendant de la plateforme 221Cloud partagée.

## État actuel

- `GET /api/health` : vérification technique du Worker.
- `GET /api/v1/football/fixtures` : route réservée aux rencontres ; répond volontairement avec `503 provider_not_configured` tant que l'adaptateur fournisseur n'est pas implémenté et testé.
- Aucun accès D1 n'est configuré.
- Aucun secret ni identifiant API n'est stocké dans ce dépôt.
- Aucun déploiement n'a été effectué.

## Configuration

Le fichier `wrangler.jsonc` définit seulement l'origine locale de développement (`http://localhost:5173`). Avant tout déploiement, remplacer cette valeur par l'origine exacte du site FutPulse après validation.

La clé API-Football, si son utilisation est validée, devra être ajoutée comme secret Cloudflare nommé `API_FOOTBALL_KEY`. Ne jamais la placer dans le code du navigateur, dans `vars`, ni dans Git.

## Limites de sécurité

Ce Worker n'est pas encore prêt pour la production. Il ne contacte aucun fournisseur, ne lit ni n'écrit aucune base de données et ne contient aucune logique de synchronisation.
