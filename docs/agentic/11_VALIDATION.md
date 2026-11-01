# Validation étape 11 — Job Discovery Agent

## Couverture locale

- 4 tests de structure et de sécurité (`agentic-stage11.test.mjs`).
- 7 tests d'exécution des outils réels avec injection d'adaptateurs (`agentic-stage11-unit.test.cjs`) : sources HTTPS, déduplication, pertinence, préférences strictes, score contrôlé, quotas, panne partielle, absence de résultats.
- 3 tests d'intégration LangGraph (avec dépendances applicatives) dans `agentic-stage11-integration.test.mjs`.
- Analyse syntaxique TypeScript des fichiers modifiés ; aucun secret ni variable `.env` modifié.

## Tests qui demandent un environnement de projet complet

- `npm run test:agentic:stage11:integration` (LangGraph, Zod, Prisma).
- `npm run typecheck`, `npm run build` (Next.js, Prisma généré, dépendances installées).
- Recette manuelle de l'interface : connexion utilisateur, 1 CV choisi, offres du catalogue réelles, préférences, détails, sauvegarde, création de dossier, indisponibilité du modèle, quota épuisé, annulation.

## Critères d'acceptation

1. L'utilisateur authentifié peut choisir son CV et obtenir des offres vérifiables et pertinentes sans dépendre exclusivement de l'IA.
2. Aucun score heuristique non vérifié, aucune offre créée artificiellement, aucun emploi en arrière-plan.
3. L'agent Jobs for You réutilise Job Match Agent de l'étape 10 au lieu de réécrire son moteur de correspondance.
4. L'ouverture de l'offre permet de préparer un dossier de candidature, mais ne soumet rien automatiquement.
5. Les filtres et la propriété du CV ne peuvent pas être contournés par une requête cliente.

**Note** : tests d'intégration avec dépendances et tests de production à confirmer dans un environnement complet. Ne pas assimiler cette limite à une validation de mise en production.
