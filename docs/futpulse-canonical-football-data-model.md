# Modèle canonique de données football — FutPulse / 221Cloud

**Statut :** proposition de modèle logique à relire avant implémentation. Ce document ne crée aucune table D1, migration, API ou modification de production. Il décrit un contrat interne indépendant des fournisseurs.

## 1. Principes

1. Les identifiants internes FutPulse sont les références publiques stables. Les identifiants API-Football ou d'un autre fournisseur restent des identifiants externes.
2. Une même entité peut être reliée à plusieurs fournisseurs par des correspondances explicites.
3. Les données brutes reçues sont conservées séparément des données normalisées, avec une durée de conservation à définir selon les droits du fournisseur.
4. Chaque donnée importante porte sa provenance, son horodatage de collecte et son état de vérification.
5. Une absence de donnée n'est jamais transformée en zéro, en valeur supposée ou en fait généré par l'IA.
6. Les applications Web, Android et iOS consomment les mêmes endpoints 221Cloud et le même modèle normalisé.

## 2. Entités et relations

| Entité | Rôle | Relations principales |
|---|---|---|
| `countries` | Pays et codes normalisés | compétitions, clubs |
| `competitions` | Ligue ou coupe | saisons |
| `seasons` | Saison d'une compétition | compétition, matchs, classement |
| `teams` | Clubs et sélections | matchs, joueurs, entraîneurs |
| `players` | Identité stable des joueurs | effectifs, événements, statistiques |
| `coaches` | Identité stable des entraîneurs | affectations club/saison |
| `team_memberships` | Appartenance d'un joueur à un club sur une période | joueur, club, saison |
| `coach_assignments` | Affectation d'un entraîneur à un club sur une période | entraîneur, club |
| `fixtures` | Matchs, programmés ou terminés | compétition, saison, équipes, stade |
| `fixture_events` | Buts, cartons, remplacements, VAR, etc. | match, équipe, joueur, passeur |
| `venues` | Stades et lieux | matchs |
| `standings_snapshots` | Instantané de classement daté | compétition, saison, club |
| `player_season_stats` | Statistiques agrégées d'un joueur dans une saison | joueur, club, compétition, saison |
| `lineups` | Compositions et positions pour un match | match, équipe, joueur |
| `match_team_stats` | Statistiques d'une équipe pour un match | match, équipe |
| `provider_entities` | Correspondance entité interne ↔ identifiant externe | type d'entité, fournisseur |
| `provider_sync_state` | Suivi des collectes et erreurs par ressource | fournisseur, ressource |
| `provider_payloads` | Réponse brute ou référence d'archive, si conservation autorisée | fournisseur, ressource |
| `data_conflicts` | Divergences entre fournisseurs ou versions | entité, champs concernés |

Les noms ci-dessus sont des noms logiques proposés, pas des tables existantes.

## 3. Champs communs de provenance

Pour toute donnée synchronisée, prévoir selon le besoin :

- `id` : identifiant interne UUID ou identifiant opaque généré par 221Cloud.
- `provider_code` : code du fournisseur, par exemple `api_football`.
- `provider_entity_id` : identifiant externe conservé comme chaîne.
- `source_updated_at` : date de mise à jour indiquée par la source, si fournie.
- `fetched_at` : date UTC à laquelle 221Cloud a reçu la donnée.
- `valid_from` / `valid_to` : période de validité lorsque la donnée est temporelle.
- `data_status` : état normalisé de disponibilité ou de vérification.
- `raw_payload_ref` : référence facultative à la réponse brute, uniquement si sa conservation est autorisée.

Ne pas ajouter aveuglément tous ces champs à chaque table : les tables de relation et d'événement ne nécessitent pas toutes les mêmes métadonnées. La provenance doit toutefois rester traçable.

## 4. Champs fonctionnels essentiels

### Compétition et saison

- `competition` : nom canonique, pays, type (league/cup), genre/catégorie si disponible, statut.
- `season` : compétition, libellé (ex. 2024), dates de début et fin si connues, statut.
- Les champs de couverture sont suivis par fournisseur, compétition, saison et type de donnée : fixtures, events, standings, players, lineups, statistics, coaches.

### Clubs et personnes

- `team` : nom canonique, nom court, pays, logo et alias éventuels.
- `player` : nom affiché, prénom/nom si disponibles, date de naissance, nationalité, poste principal, pied fort, photo.
- `coach` : nom affiché, nationalité, photo si disponible.
- Les photos et logos doivent garder une source et des droits d'affichage vérifiables.
- Ne jamais fusionner deux joueurs uniquement parce que leurs noms se ressemblent : utiliser les identifiants externes et des règles de rapprochement contrôlées.

### Match

- `competition_id`, `season_id`, `home_team_id`, `away_team_id`, `venue_id`.
- `scheduled_at` en UTC, fuseau d'affichage déterminé côté client.
- `status` normalisé : `scheduled`, `live`, `halftime`, `finished`, `postponed`, `cancelled`, `suspended`, `unknown`.
- `home_score`, `away_score`, scores de période, prolongation et tirs au but, stockés comme valeurs nullables.
- `elapsed_minutes` et temps additionnel lorsque disponibles.
- `provider_updated_at`, `fetched_at`, `is_stale` ou un calcul de fraîcheur côté API.

Un score nul n'est pas équivalent à un score égal à zéro. Un match sans score confirmé garde des valeurs nulles.

### Événement de match

- `fixture_id`, `team_id`, `player_id`, `related_player_id` (ex. passeur ou joueur entrant/sortant).
- `event_type` : `goal`, `card`, `substitution`, `var`, `penalty`, `other`.
- `event_detail` : but normal, contre son camp, jaune, rouge, amélioration VAR, etc.
- `elapsed_minute`, `added_minute`, `sequence`.
- `description` facultative, `provider_event_id` si la source en fournit un.

Pour les remplacements, stocker séparément le joueur entrant et le joueur sortant lorsque le fournisseur les distingue. Ne pas supposer que le champ « assist » signifie toujours passe décisive : son sens dépend du type d'événement.

### Classement et statistiques

- Un classement est un instantané : compétition, saison, date de collecte, position, club, matchs joués, victoires, nuls, défaites, buts pour/contre, différence et points.
- Les classements gardent leur provenance et ne sont jamais présentés comme complets si la source ne retourne qu'une partie des équipes.
- Les statistiques de joueurs et d'équipes distinguent les valeurs absentes des valeurs égales à zéro et précisent leur périmètre (match, saison, compétition).

## 5. Correspondance multi-fournisseurs

La table logique `provider_entities` doit permettre :

- `provider_code`
- `entity_type` (competition, season, team, player, coach, fixture, venue, event)
- `internal_entity_id`
- `external_entity_id`
- `first_seen_at`, `last_seen_at`
- `match_method` (manual, exact_id, reviewed_match)
- `confidence` facultatif, uniquement pour les rapprochements non définitifs
- `is_verified`

Contraintes à prévoir : unicité du triplet fournisseur/type/identifiant externe ; unicité de la correspondance fournisseur/type/entité interne lorsque cela est nécessaire. Les rapprochements ambigus passent en revue manuelle, jamais en fusion automatique basée uniquement sur le nom.

## 6. Synchronisation et gestion des quotas

La table logique `provider_sync_state` suit :

- fournisseur, ressource, compétition/saison ou identifiant de match concerné ;
- `last_attempt_at`, `last_success_at`, `next_attempt_at` ;
- résultat (`success`, `partial`, `failed`, `rate_limited`) ;
- nombre d'éléments reçus, nombre d'erreurs, code HTTP ;
- quota restant et date de réinitialisation lorsque le fournisseur les expose ;
- âge de la dernière donnée et raison d'un retard.

La collecte est centralisée côté serveur. Le navigateur et les applications mobiles ne contactent jamais directement API-Football. Utiliser un cache, des fenêtres de rafraîchissement adaptées au type de donnée et un backoff en cas d'erreur. Ne pas gaspiller le quota en relançant la même requête à chaque visite.

## 7. Contrat API interne proposé

Les routes ci-dessous sont des propositions de contrat, pas des endpoints déjà créés :

- `GET /api/v1/football/competitions`
- `GET /api/v1/football/competitions/{competitionId}/seasons`
- `GET /api/v1/football/fixtures?date=YYYY-MM-DD&competitionId=...`
- `GET /api/v1/football/fixtures/{fixtureId}`
- `GET /api/v1/football/fixtures/{fixtureId}/events`
- `GET /api/v1/football/standings?competitionId=...&seasonId=...`
- `GET /api/v1/football/teams/{teamId}`
- `GET /api/v1/football/players/{playerId}`
- `GET /api/v1/football/players/{playerId}/statistics?seasonId=...`

Chaque réponse doit exposer au minimum `data`, `meta.fetchedAt`, `meta.source`, `meta.isStale` et `meta.coverage` lorsque ces informations s'appliquent. Les erreurs fournisseur ne doivent pas être maquillées en réponses vides : distinguer absence confirmée, non couvert, quota dépassé et panne.

## 8. Garde-fous IA

- L'IA lit les données normalisées et leurs métadonnées de provenance.
- Elle peut résumer, comparer et expliquer, mais ne peut pas inventer un score, un buteur, une composition, une statistique ou un entraîneur.
- En cas de données manquantes ou contradictoires, elle doit le dire et citer les sources disponibles.
- Un contenu éditorial ou une actualité nécessite une vérification distincte ; une réponse d'IA n'est pas une source primaire.

## 9. Ordre de mise en œuvre proposé

1. Relire et valider ce modèle logique.
2. Vérifier les schémas et conventions déjà présents dans le dépôt 221Cloud/FutPulse pour éviter les doublons.
3. Écrire un schéma SQL D1 et des migrations versionnées, seulement après validation.
4. Ajouter les types TypeScript et validateurs de normalisation.
5. Construire l'adaptateur API-Football derrière une interface fournisseur.
6. Tester l'import sur une compétition historique, puis comparer les résultats à la source.
7. Ajouter les contrôles de quotas, fraîcheur, erreurs et reprise.
8. Exposer les endpoints communs avant de brancher les interfaces Web et mobiles.

## 10. Hors périmètre

Ce modèle ne crée pas de tables, ne modifie pas D1, les Workers, les secrets, les applications ou les données de production. Il ne suppose pas que tous les champs sont couverts par API-Football. Les migrations ne doivent être créées qu'après examen de l'architecture réelle et validation explicite.


## 11. Audit de l'architecture 221Cloud avant migration — 26 novembre 2026

L'inspection du dépôt `221cloud/futpulse` seul ne suffisait pas à identifier le backend. Le compte GitHub connecté donne aussi accès au dépôt `221cloud/221cloud-platform.`, qui contient le Worker principal de la plateforme.

### Éléments confirmés dans 221Cloud

Le fichier `wrangler.jsonc` du dépôt `221cloud/221cloud-platform.` déclare :

- Worker `221cloud-platform`, entrée `src/index.js`.
- Binding D1 `DB`, base `221cloud-main`.
- Binding Cloudflare AI `AI`.
- Assets statiques servis depuis `public`.
- Cron configuré chaque minute.
- Observabilité des logs activée dans la configuration.

Le code existant utilise déjà D1 depuis les modules `src/editorial-agent.js` et `src/editorial-feeds.js`. Il crée certaines tables à l'exécution avec `CREATE TABLE IF NOT EXISTS`, notamment `editorial_items`, `editorial_ai_usage` et `editorial_drafts`, et crée des index associés.

### Conséquences pour FutPulse

Le backend 221Cloud et une base D1 existent donc déjà dans ce dépôt. Il ne faut surtout pas créer une deuxième base ou un deuxième Worker pour FutPulse sans raison architecturale validée.

En revanche, l'inspection GitHub du dépôt ne permet pas à elle seule de lire l'état réel de la base D1 distante, les migrations déjà appliquées, les éventuelles tables créées dynamiquement par d'autres chemins d'exécution, ni de confirmer quel déploiement est actuellement actif. Le nom de Worker et sa configuration déclarée ne constituent pas une preuve de déploiement réussi ou de correspondance avec l'environnement de production.

### Décision avant SQL

Aucune migration football n'est créée ou appliquée à ce stade. Avant de proposer le SQL, il faut encore :

1. Examiner les conventions de routage et d'authentification du Worker dans `src/index.js`.
2. Examiner les schémas D1 déjà créés dans les modules et les éventuelles fonctions d'administration de base de données.
3. Vérifier l'état réel de la base D1 distante en lecture seule, si l'accès disponible le permet.
4. Déterminer si FutPulse doit utiliser le D1 principal existant avec séparation logique des données, ou un D1 distinct, après comparaison des contraintes d'isolation, de quotas et de sauvegarde.

Cet audit GitHub est documentaire et en lecture seule pour le backend. Aucun Worker, binding, secret, schéma D1, donnée ou déploiement de production n'a été modifié.
