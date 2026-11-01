# Étape 03 — matrice de validation

## Vérifications hors base de données

Exécuter :

```bash
node --experimental-strip-types --test scripts/agentic-stage01.test.cjs scripts/agentic-stage02.test.mjs scripts/agentic-stage03.test.mjs
npm run check:syntax
npm run test:cvcomet:baseline
npm run test:phase14
```

Les tests ajoutés vérifient : séparation des locataires, mission UUID, pool borné, aucune connexion de fallback vers l'URL poolée, SQL paramétré de verrouillage, refus des démarrages doublons, approbation réellement en attente, retry d'étape en échec, identité de reprise, concurrence, suppression et événements `run.paused`.

## Portes obligatoires à passer sur la machine de développement

```bash
node --experimental-strip-types --test scripts/agentic-stage02-integration.test.mjs
npm run agentic:checkpoint:setup
# EXCLUSIVEMENT sur une base de test dédiée, avec AGENTIC_CHECKPOINT_TEST_DB=1 :
npm run test:agentic:stage03:db
npm run typecheck
npm run build
```

Ces contrôles nécessitent npm, PostgreSQL et/ou un environnement Next.js. Sans leur succès, **ne pas déclarer que la persistance réelle en production est validée**.

## Périmètre non modifié

API métier, schéma Prisma, frontend, éditeur de CV, ATS, Career Assistant, entretiens LiveKit, envoi de candidatures, paiements, prompts/fournisseurs IA, authentification existante.

## Dépendances nouvelles

`@langchain/langgraph-checkpoint-postgres`, `pg` et les types `@types/pg`. Aucune migration Prisma.
