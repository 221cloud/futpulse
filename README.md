# FutPulse

**Le football, en temps réel.**

FutPulse est une plateforme football internationale pensée pour le Web, Android et iOS, avec une première version Web responsive et installable (PWA).

## Direction produit

- Football uniquement
- Interface premium sombre : noir, bleu nuit et vert lumineux
- Français et anglais
- Gratuit au lancement
- Architecture conçue pour accueillir progressivement les données, les comptes et les fonctionnalités communautaires

## Première version

Cette première interface est une maquette fonctionnelle côté navigateur. Elle comprend une navigation, une recherche simple, des matchs de démonstration, des favoris locaux et des exemples de rubriques d'actualité.

> **Important :** les matchs, scores et articles actuellement affichés sont des données fictives de démonstration. Aucun fournisseur de données football en direct ni système de publication n'est connecté.

## Démarrer en local

Prérequis : Node.js 18 ou supérieur.

```bash
npm install
npm run dev
```

Pour vérifier la compilation :

```bash
npm run build
npm run preview
```

## Prochaines étapes envisagées

1. Vérifier et améliorer l'interface sur mobile.
2. Définir les sources de données football autorisées et leurs licences.
3. Ajouter une API serveur et une base de données.
4. Connecter les matchs, compétitions, clubs, joueurs et statistiques à des sources réelles.
5. Construire l'administration, les comptes et les notifications.

Les données réelles ne seront affichées qu'après intégration et vérification de sources adaptées. La couverture et le direct dépendront des droits, des limites et des conditions des fournisseurs retenus.
