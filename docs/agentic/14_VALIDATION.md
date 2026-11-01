# Étape 14/20 — Rapport de validation locale

Base : archive cumulative de l'étape 13, avec sources originales de `cvcomet(3).zip`. Aucun `.env`, aucune clé fournisseur, aucune migration et aucun fichier du projet inchangé ne doivent être inclus dans la livraison.

## Vérifications locales

- `npm run test:agentic:stage14` : validations de session, limites de tailles, quatre nœuds de préparation, quatre nœuds d'évaluation, code des scores, preuves réelles, cas d'échec et orchestration simulée.
- `node --experimental-strip-types --test scripts/interviews-screening-2026.test.mjs` : compatibilité des routes, LiveKit, consentement et politique de score existante.
- `npm run test:phase10` : non-régression historique des entretiens textuels.
- `npm run test:agentic:stage10`, `stage11`, `stage12`, `stage13` : non-régression des agents des étapes précédentes.
- `node --check workers/screening-agent.mjs` et `node --check scripts/agentic-stage14-reconcile.mjs` : syntaxe des processus.
- Trois tests de service avec Prisma simulé : préparation refusée si la session n'est plus active, appels concurrents avec une seule évaluation payante et une seule transcription enregistrée, refus des salles ou consentements invalides.
- Tests de contrat de la maintenance de sessions expirées (la base Prisma réelle reste à tester).
- Contrôle du ZIP et manifeste SHA-256 : périmètre cumulatif uniquement.

## Non validé dans cet environnement

- `npm run test:agentic:stage14:integration` : nécessite `node_modules` avec `@langchain/langgraph`.
- `npm run typecheck`, `npm run build`, génération Prisma et intégration réelle Neon/LiveKit/Realtime : dépendances et clés de services absentes.
- Test PostgreSQL réel de concurrence : compare-and-swap `VOICE_EVALUATING`, transaction d'enregistrement et tâche de réconciliation horaire.
- Configuration effective du cron de réconciliation et vérification des alertes de sessions abandonnées.

Les tests locaux qui exécutent un graphe **simulé** ne constituent pas une validation du runtime LangGraph installé. L'étape 15 ne doit pas être commencée sans validation explicite de l'étape 14.
