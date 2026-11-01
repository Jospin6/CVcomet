# Étape 04 — Validation et limites

- Livraison cumulative : étapes 01, 02, 03, 04 depuis `cvcomet(3).zip`.
- Aucun fichier des anciennes archives LangGraph n'est inclus en remplacement de la base utilisateur.
- Tests ciblés en mémoire : `scripts/agentic-stage04.test.mjs`.
- Test LangGraph réel bloquant : `scripts/agentic-stage04-integration.test.mjs`.
- Correctif de sécurité de l'étape 03 inclus : son nœud `interrupt()` n'est plus enveloppé dans `tracedNode`, qui normalisait la suspension comme une erreur.
- Les scores ATS, le code des pages, les migrations Prisma et les règles métier restent inchangés.

## Résultats vérifiés dans l’environnement de préparation

- Socle agentique étapes 01–04 : **46/46 tests réussis**.
- Tests CVComet phases 00–13 : **190/190 réussis**.
- Tests de phase 14 : **4/4 réussis**.
- Contrôle de syntaxe : **466 fichiers TypeScript/TSX, zéro erreur**.
- Vérification stricte du noyau indépendant des packages externes : **réussie**.
- Intégration réelle LangGraph : **non validée ici**, l'exécution du test bloquant échoue faute de package installé (`ERR_MODULE_NOT_FOUND`).

## Contrôles à effectuer sur la machine du projet

1. `npm install`
2. `npm run test:agentic:stage04`
3. `npm run test:agentic:stage04:integration`
4. `npm run test:cvcomet:baseline`
5. `npm run typecheck`
6. `npm run build`
7. Réexécuter l'intégration DB dédiée de l'étape 03 (`AGENTIC_CHECKPOINT_TEST_DB=1`, base de test uniquement).

## Non certifié dans l'environnement de préparation

- Installation des dépendances npm.
- Vérification sémantique du TypeScript et compilation Next.js.
- Appels réels aux modèles / à Neon.
- Exécution de l'interruption du graphe de démonstration avec le package LangGraph installé.

**Ne pas activer en production tant que les contrôles précédents ne sont pas validés.**
