# Cahier des charges — Données football et moteur IA FutPulse

**Statut :** API-Football est retenu comme fournisseur provisoire n°1 pour les premiers travaux d'intégration. Documentation uniquement : aucun fournisseur n'est encore connecté à la production, aucune clé API n'est requise et aucune donnée de production n'est modifiée.

## 1. Objectif

FutPulse doit fournir une expérience football rapide et fiable sur le Web, Android et iOS. Les trois clients utiliseront les mêmes services 221Cloud et la même source de vérité. L'IA enrichit les données et les contenus ; elle ne remplace jamais les fournisseurs factuels pour les scores, événements ou statistiques.

## 2. Données attendues

- Compétitions : pays, saisons, calendriers, journées, classements et couverture disponible.
- Matchs : équipes, coup d'envoi, statut, score, prolongations et tirs au but.
- Direct : buts, buteurs, cartons, remplacements, VAR, compositions et chronologie.
- Clubs : identité stable, nom, pays, effectif et entraîneur.
- Joueurs : identité stable, poste, nationalité, profil et statistiques sourcées.
- Entraîneurs : identité, club, historique et statistiques lorsque disponibles.
- Actualités : articles, sources, dates, liens, état de vérification et validation éditoriale.

Chaque donnée conserve son fournisseur, son identifiant externe, son heure de collecte, son heure de mise à jour chez le fournisseur si disponible et son niveau de couverture.

## 3. Architecture cible

1. **Adaptateurs fournisseurs** : un adaptateur isolé par API. Aucun code d'interface ne dépend du format brut d'un fournisseur.
2. **Normalisation 221Cloud** : conversion vers un modèle interne commun, identifiants stables et déduplication.
3. **Stockage D1** : données normalisées et métadonnées de synchronisation ; migrations versionnées.
4. **Cache Cloudflare** : cache des données peu changeantes et cache court pour les matchs en cours.
5. **API 221Cloud** : endpoints communs au Web et aux apps mobiles.
6. **Diffusion** : commencer par du polling adaptatif et conditionnel ; évaluer SSE/WebSocket uniquement si nécessaire.
7. **Moteur IA** : consomme les données normalisées ; résume, compare, détecte les incohérences et rédige. Il ne doit jamais inventer ou corriger silencieusement un score.

## 4. Rapidité et fiabilité

- Afficher l'heure de dernière actualisation des données live.
- Respecter les limites et recommandations du fournisseur.
- Centraliser la collecte côté serveur : aucune requête fournisseur par visiteur.
- Utiliser cache, backoff exponentiel, jitter et circuit breaker en cas de panne.
- Ne jamais remplacer un score confirmé par une valeur plus ancienne ou incohérente.
- En cas de panne, afficher la dernière donnée connue avec son horodatage et un indicateur de retard.
- Journaliser erreurs, latence, quota restant, âge des données et couverture par compétition.
- Tester charge, reprise et quotas avant ouverture publique.

**Cibles initiales à mesurer (objectifs, pas garanties) :**
- API 221Cloud p95 inférieur à 500 ms sur données en cache.
- Affichage d'un score déjà collecté en moins d'une seconde côté API.
- Âge des données live cible inférieur à 60 secondes lorsque le fournisseur publie à cette fréquence ; toujours afficher l'âge réel.
- Aucun affichage « En direct » si le statut ou la fraîcheur n'est pas confirmé.

## 5. Comparaison préliminaire des fournisseurs

### API-Football / API-Sports — fournisseur provisoire n°1

**Décision provisoire : retenu pour préparer le premier adaptateur et poursuivre les validations, sans connexion à la production.**

- Offre gratuite observée dans le compte de test : 100 requêtes/jour.
- Les endpoints testés permettent de récupérer les fixtures et les événements de match.
- Les résultats dépendent fortement de la compétition et de la saison ; la présence d'une ligue dans le catalogue ne garantit pas l'accès à toutes ses saisons ou à tous ses types de données.
- Le forfait gratuit doit être considéré comme un environnement de test et de collecte limitée, pas comme une capacité validée pour couvrir en direct de nombreux championnats.
- Les droits de stockage, d'affichage et de redistribution dans une application publique doivent être confirmés dans les conditions applicables avant toute mise en production.

**Tests manuels réalisés avec le compte gratuit de l'utilisateur :**

1. **Premier League, saison 2024 — fixtures**
   - Requête : league=39, season=2024, du 19 au 20 octobre 2024.
   - Résultat observé : 9 matchs, aucune erreur, tous au statut FT.
   - Les réponses contenaient les équipes, identifiants, scores finaux, scores à la mi-temps, dates, stades et journées.

2. **Tottenham – West Ham — événements**
   - Fixture : 1208099 ; score final observé : 4–1.
   - Résultat observé : 20 événements.
   - Détail reçu : 5 événements de but, 4 cartons jaunes, 1 carton rouge, 9 remplacements et 1 événement VAR.
   - Les événements contenaient les minutes, équipes, joueurs et, lorsque renseignés, les passeurs.
   - Certains champs d'assistance étaient nuls : la complétude n'est donc pas absolue.

3. **Ligue 1 sénégalaise — couverture**
   - Les tests précédents ont montré un accès historique partiel, notamment pour certains matchs et événements.
   - La saison 2026 n'était pas accessible avec le forfait gratuit testé.
   - Les données de joueurs, classements, entraîneurs et effectifs sénégalais doivent être considérées comme non validées ou incomplètes tant que des tests spécifiques ne démontrent pas le contraire.

4. **Limite de la validation**
   - Les tests sont des essais manuels effectués dans le tableau de bord ; ils ne constituent pas un test automatisé de l'intégration 221Cloud.
   - Les classements, effectifs, profils complets, statistiques détaillées, données live et droits de redistribution restent à vérifier.

Sources :
- https://www.api-football.com/pricing/
- https://www.api-football.com/coverage/
- https://www.api-football.com/documentation-v3
- https://www.api-football.com/terms

### Sportmonks — candidat de comparaison

- Offre gratuite de test annoncée avec la Superliga danoise et la Scottish Premiership.
- API riche : fixtures, livescores, événements, lineups, statistiques, profils joueurs et données d'entraîneurs selon couverture.
- Les forfaits payants sont structurés par nombre de championnats ; le prix Starter affiché commence à 29 €/mois pour 5 ligues.
- Conclusion : bon candidat technique à comparer, mais son offre gratuite ne permet pas à elle seule de tester la Ligue 1 sénégalaise.

Sources :
- https://www.sportmonks.com/football-api/free-plan/
- https://www.sportmonks.com/football-api/coverage/
- https://www.sportmonks.com/football-api/plans-pricing/

### football-data.org — candidat secondaire limité

- Offre gratuite : 12 compétitions, calendriers, classements et scores retardés ; 10 appels/minute annoncés.
- Le livescore est proposé dans une offre payante ; la liste des compétitions gratuites publiée ne comprend pas le Sénégal.
- Conclusion : utile éventuellement pour certaines compétitions européennes, pas comme source principale de FutPulse.

Sources :
- https://www.football-data.org/pricing
- https://www.football-data.org/coverage

## 6. Plan de test fournisseur — sans engagement payant

### Phase A — couverture

Pour API-Football, vérifier dans les réponses réelles les saisons et les champs de couverture des compétitions prioritaires : fixtures, events, lineups, statistics et players. Répéter pour les compétitions africaines et internationales. Ne pas déduire la disponibilité d'une simple présence du nom de la compétition.

### Phase B — qualité

Sur un échantillon de matchs terminés et en cours, comparer score final et statut, horodatage et minute, buts, cartons, remplacements, compositions, statistiques, profils joueurs et entraîneurs. Comparer à une source officielle ou indépendante fiable lorsque disponible. Mesurer retards, champs manquants et divergences.

### Phase C — quotas et coûts

Simuler le nombre de compétitions suivies, de matchs en direct et d'appels par jour. Avec 100 requêtes/jour sur le forfait gratuit testé, prévoir une collecte sélective et un cache serveur strict. Aucun plan payant sans décision explicite.

### Phase D — décision

Noter chaque fournisseur : couverture Sénégal/Afrique (25 %), fraîcheur live (20 %), exactitude/complétude (20 %), coût et quotas (15 %), stabilité/documentation (10 %), droits d'utilisation et conditions de redistribution (10 %). La décision finale exige des tests réels et la lecture des conditions contractuelles.

## 7. Modèle interne indépendant du fournisseur

Entités proposées : competition, season, team, player, coach, fixture, fixture_event, lineup, match_statistic et provider_sync_state.

Pour chaque entité, conserver un identifiant interne, le fournisseur et son identifiant externe, les champs normalisés, source_updated_at, fetched_at, data_status, métadonnées de couverture et divergences éventuelles.

Les identifiants fournisseur ne deviennent jamais les identifiants publics permanents de FutPulse. Un second fournisseur doit pouvoir être ajouté sans changer les contrats de l'API publique.

## 8. Rôle de l'IA et garde-fous

- Utiliser les données structurées comme référence pour scores, dates, événements et statistiques.
- Fournir à l'IA les sources, horodatages et niveaux de confiance.
- Distinguer fait confirmé, source unique, information manquante et contradiction.
- Refuser de produire une statistique ou un événement absent des données disponibles.
- Exiger une validation éditoriale avant publication d'actualités.
- Ne pas faire dépendre le rendu des scores live d'un appel LLM : les données factuelles doivent s'afficher même si l'IA est indisponible.

## 9. Ordre de réalisation

1. Enregistrer API-Football comme fournisseur provisoire n°1 et conserver le choix réversible.
2. Terminer les tests de couverture, qualité, quotas et droits d'utilisation avec le compte gratuit.
3. Définir et relire le schéma canonique et les migrations.
4. Construire un adaptateur isolé et les endpoints API communs.
5. Tester d'abord une compétition et un petit nombre de matchs.
6. Ajouter progressivement les compétitions prioritaires et les écrans Web.
7. Réutiliser les mêmes endpoints pour Android et iOS.
8. Ajouter l'IA d'analyse une fois les données structurées et observables.

## 10. Hors périmètre

Aucune connexion API, clé secrète, migration D1, modification du Worker de production, achat, abonnement, publication automatique ou déploiement n'est effectué par ce document.
