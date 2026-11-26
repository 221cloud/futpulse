# Proposition de schéma D1 football FutPulse — v1

**Statut : proposition technique à relire. Non appliquée.**  
**Cible envisagée :** Cloudflare D1 du Worker 221Cloud, avec préfixe `fp_`.  
**Périmètre :** données sportives partagées entre le site FutPulse et ses futures applications mobiles.

## 1. Décisions d'architecture

1. La table applicative éditoriale FutPulse existante reste dédiée aux contenus éditoriaux. Elle n'est ni renommée ni modifiée.
2. Les données football sont stockées dans des tables dédiées `fp_*`, séparées du modèle de bases de données personnalisables `customer_*`.
3. Les données sportives sont globales au produit FutPulse, et non dupliquées par utilisateur ou projet.
4. Les identifiants internes FutPulse sont indépendants des identifiants des fournisseurs. La table `fp_provider_entity_mappings` relie les identifiants externes aux entités canoniques.
5. Les valeurs propres à chaque fournisseur qui varient ou ne sont pas encore normalisées peuvent rester dans des colonnes JSON validées, sans faire de ces JSON la source principale des relations.
6. Les dates sont stockées en UTC au format ISO-8601. Les identifiants externes sont du texte afin de préserver leur représentation.
7. Les suppressions physiques sont évitées dans le flux normal. Les corrections et désactivations passent par des mises à jour contrôlées et une traçabilité des synchronisations.

## 2. État réel observé

L'inventaire exécuté dans la console Cloudflare a confirmé :
- le projet `FutPulse`, de type `application`, publié sous le slug `futpulse-7ffb77c9` ;
- une base applicative FutPulse avec une table physique personnalisée contenant `row_id`, `created_at` et sept colonnes éditoriales (`titre`, `contenu`, `categorie`, `image_url`, `source`, `date_publication`, `statut`) ;
- les tables éditoriales `editorial_items`, `editorial_drafts`, `editorial_ai_usage` et `futpulse_editorial_auto_runs) ;
- aucune table football dédiée dans l'inventaire fourni.

Cet inventaire décrit la base D1 interrogée à ce moment-là. Il ne prouve pas que tous les environnements (preview, production, développement) ont le même schéma.

## 3. Tables proposées

Le SQL associé est dans [`futpulse-football-d1-schema-v1.sql`](./futpulse-football-d1-schema-v1.sql).

| Domaine | Tables | Rôle |
|---|---|---|
| Référentiels | `fp_countries`, `fp_competitions`, `fp_seasons` | Pays, compétitions et saisons |
| Entités | `fp_teams`, `fp_players`, `fp_coaches`, `fp_venues` | Fiches canoniques |
| Affectations | `fp_team_memberships`, `fp_coach_assignments` | Effectifs et historique des entraîneurs |
| Matchs | `fp_fixtures`, `fp_fixture_events` | Calendrier, scores et événements |
| Compositions | `fp_fixture_lineups`, `fp_fixture_lineup_players` | Formations, titulaires et remplaçants |
| Classements | `fp_standings_snapshots`, `fp_standing_rows` | Historique des classements |
| Statistiques | `fp_player_season_stats`, `fp_fixture_team_stats`, `fp_fixture_player_stats` | Statistiques de saison et de match |
| Provenance | `fp_provider_entity_mappings`, `fp_provider_sync_state`, `fp_provider_raw_payloads` | Identifiants externes, suivi des synchronisations et réponses sources |
| Qualité | `fp_data_conflicts` | Divergences à examiner |

## 4. Flux d'ingestion proposé

1. Un ordonnanceur serveur sélectionne les compétitions, saisons et matchs à actualiser.
2. Un adaptateur fournisseur appelle l'API avec des quotas, délais d'attente, reprises et limites strictes.
3. La réponse brute est validée et conservée avec le fournisseur, l'endpoint, l'heure de collecte et le statut HTTP.
4. Les identifiants externes sont résolus par `fp_provider_entity_mappings`. Une entité non résolue est créée ou mise en file d'examen selon les règles de rapprochement ; ne jamais fusionner deux personnes ou équipes uniquement sur la base d'un nom similaire.
5. Les données sont normalisées et écrites par lots dans une transaction lorsque c'est possible.
6. `fp_provider_sync_state` est actualisée. Les erreurs et divergences sont conservées, pas silencieusement transformées en données valides.
7. L'API 221Cloud sert les données depuis D1 et son cache. Le site et les applications mobiles ne contactent pas directement le fournisseur.

## 5. Règles de fiabilité

- Un score n'est publiable comme définitif que si le statut du match fourni l'indique ; un score absent reste absent, jamais remplacé par zéro.
- Chaque donnée exposée doit pouvoir être reliée à un fournisseur et à une heure de collecte.
- Les données anciennes doivent porter un indicateur de fraîcheur (par exemple `updated_at` ou `last_success_at`) et l'API doit pouvoir signaler qu'elles sont périmées.
- L'IA peut résumer, comparer et analyser les données présentes. Elle ne doit pas inventer un score, un événement, une statistique, un joueur ou un entraîneur manquant.
- Les champs JSON servent à conserver des statistiques fournisseur variables. Les champs utilisés pour filtrer, trier ou relier des enregistrements doivent être normalisés et indexés.
- Une donnée contradictoire crée une entrée dans `fp_data_conflicts` ou est conservée pour arbitrage ; elle ne doit pas être écrasée sans règle de priorité documentée.

## 6. Adaptateur fournisseur et API-Football

API-Football reste un fournisseur **provisoire**, pas une dépendance validée pour toute la couverture FutPulse. Les essais manuels précédents ont confirmé certains résultats historiques de Premier League et leurs événements, mais ont aussi montré que le forfait gratuit ne donne pas accès à la saison actuelle de Ligue 1 sénégalaise testée. La couverture des classements, effectifs, entraîneurs, compositions et statistiques complètes doit encore être vérifiée pour chaque compétition cible.

En conséquence :
- ne pas annoncer de couverture live au Sénégal sur la base de ces tests ;
- ne pas synchroniser à grande échelle avant d'avoir validé couverture, quotas, conditions d'affichage, cache et redistribution ;
- garder l'adaptateur remplaçable pour pouvoir ajouter un second fournisseur sans changer les identifiants canoniques ;
- stocker les identifiants externes comme du texte et renseigner `provider_code` explicitement (par exemple `api_football`).

## 7. Index et performances

Le SQL propose des index pour les recherches les plus fréquentes : calendrier par date, compétition/saison, équipe domicile/extérieur, statut du match, événements d'un match, classements, statistiques joueur et tâches de synchronisation dues.

Les index ne garantissent pas à eux seuls une latence donnée. Après chargement d'un jeu de test représentatif, mesurer les plans de requête et les temps de réponse, puis retirer les index inutiles ou en ajouter sur la base des requêtes réelles.

## 8. Plan de validation avant production

1. Vérifier les sauvegardes et identifier sans ambiguïté la base de test D1 ; ne jamais confondre preview et production.
2. Vérifier la version SQLite/D1 et tester le script sur une base jetable ou de preview.
3. Contrôler la création des tables, les contraintes, les index, les clés étrangères et les insertions/relectures d'un petit jeu de données fictif.
4. Tester les cas de doublons fournisseur, d'identifiant externe inconnu, de match reporté, de score absent, d'événement corrigé, de statistiques partielles et de synchronisation interrompue.
5. Mesurer les quotas et les performances avec un petit nombre d'appels autorisés.
6. Faire relire le SQL, les conditions du fournisseur et la stratégie de sauvegarde.
7. Demander une autorisation explicite distincte avant toute écriture sur la base de production.

## 9. Retour arrière

Le fichier SQL est volontairement additif : il utilise `CREATE TABLE IF NOT EXISTS` et `CREATE INDEX IF NOT EXISTS`, sans `ALTER TABLE`, `DROP TABLE`, ni modification des tables existantes.

Pour un essai sans données utiles, la base de test peut être recréée après validation. Pour un environnement contenant déjà des données, ne pas exécuter un script de suppression improvisé : restaurer une sauvegarde vérifiée ou préparer une migration inverse distincte, avec approbation explicite. La migration proposée ne doit pas être exécutée telle quelle sur la production.

## 10. Limites et points à trancher avant implémentation

- Confirmer si les tables `fp_*` doivent vivre dans `221cloud-main` ou dans une base D1 séparée dédiée à FutPulse. La séparation dédiée réduit le risque de concurrence avec les fonctions générales de 221Cloud, mais demande une décision d'exploitation et de configuration.
- Définir les règles de rapprochement des entités et de priorité entre fournisseurs.
- Définir la politique de conservation et de purge des réponses brutes.
- Définir les compétitions et saisons du lancement ainsi que leur couverture fournisseur réelle.
- Confirmer les conditions contractuelles de mise en cache et de redistribution des données.

**Aucun SQL de ce dossier n'a été exécuté. Aucune table, donnée, configuration, clé ou déploiement de production n'a été modifié.**
