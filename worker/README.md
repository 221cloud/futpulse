# FutPulse API Worker

Service serveur indépendant de la plateforme 221Cloud partagée.

## État actuel

- `GET /api/health` : vérification technique du Worker et indication de la présence de la configuration du fournisseur (sans exposer la clé).
- `GET /api/v1/football/fixtures` : route de récupération des rencontres via l'adaptateur API-Football.
- L'adaptateur `worker/src/providers/apiFootball.ts` est implémenté : il appelle l'endpoint des rencontres API-Football et normalise les données retournées.
- Sans le secret serveur `API_FOOTBALL_KEY`, la route des rencontres répond volontairement avec `503 provider_not_configured`.
- Aucun accès D1 n'est configuré ; aucune base de données n'est lue ou modifiée.
- Aucun secret ni identifiant API n'est stocké dans ce dépôt.
- Aucun déploiement n'a été effectué.

## Configuration

Le fichier `wrangler.jsonc` définit actuellement l'origine locale de développement (`http://localhost:5173`). Avant tout déploiement, remplacer cette valeur par l'origine exacte du site FutPulse après validation. Ne pas remplacer cette valeur par une adresse supposée.

La clé API-Football, si son utilisation est validée, devra être ajoutée comme secret Cloudflare nommé `API_FOOTBALL_KEY`. Ne jamais la placer dans le code du navigateur, dans `vars`, ni dans Git.

## Vérifier la clé API-Football (test manuel, sans déploiement)

Un script de diagnostic en lecture seule est disponible :

```bash
node worker/scripts/check-provider.mjs
```

Il lit uniquement la variable d'environnement locale `API_FOOTBALL_KEY`, appelle l'endpoint fournisseur `/status`, puis affiche un résultat minimal (connexion, abonnement actif et compteur de requêtes si disponible). Il ne sauvegarde pas la clé, ne l'affiche jamais et ne modifie aucune donnée. Le script n'est pas exécuté automatiquement dans GitHub Actions.

Pour l'utiliser dans GitHub Codespaces, ajoute toi-même `API_FOOTBALL_KEY` comme secret Codespaces dans les paramètres GitHub du dépôt, puis redémarre le Codespace pour charger le secret. Ne colle jamais la clé dans le chat, dans un fichier du dépôt ou dans une commande enregistrée dans l'historique du terminal.

Ce contrôle valide l'accès au compte fournisseur, pas encore la disponibilité des compétitions/saisons ni la route fixtures du Worker.

## Limites et prochaines vérifications

Ce Worker est un socle de développement, pas encore un service prêt pour la production. Avant toute mise en ligne, il reste notamment à :

- vérifier la compilation et les tests du Worker ;
- valider les compétitions, saisons et données réellement disponibles auprès du fournisseur ;
- définir l'origine de production exacte et vérifier le CORS ;
- ajouter les protections nécessaires contre les abus et les appels excessifs ;
- décider séparément d'une stratégie de cache et, si nécessaire, d'une base D1 FutPulse indépendante.

Aucune synchronisation automatique ni aucun stockage persistant n'est actuellement configuré.
