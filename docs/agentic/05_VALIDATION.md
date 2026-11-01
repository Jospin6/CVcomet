# Étape 05 — Vérification et critères d'acceptation

## Commandes

```powershell
npm run test:agentic:stage05
node --experimental-strip-types --test scripts/agentic-stage01.test.cjs scripts/agentic-stage02.test.mjs scripts/agentic-stage03.test.mjs scripts/agentic-stage04.test.mjs scripts/agentic-stage05.test.mjs
npm run typecheck
npm run build
```

Le test `scripts/agentic-stage05.test.mjs` utilise un dépôt fictif : aucune donnée personnelle, aucun fournisseur IA et aucune base PostgreSQL nécessaires.

## Critères

1. Les sélecteurs non autorisés (dont `userId`), les UUID mal formés et les agents inconnus échouent avant toute lecture.
2. L'identité publique ne peut lire aucun contexte professionnel privé.
3. Tous les accès Prisma sont filtrés par utilisateur (CV/lettre via `conversation.userId`, offre/candidature via `userId`).
4. Les sections de CV masquées et le profil ne se retrouvent jamais dans le contexte ATS / Job Match.
5. Aucune donnée de contact personnelle ni de facturation n'est présente dans la projection par défaut.
6. Les liens entre candidature et documents sélectionnés sont vérifiés ; une incohérence bloque l'opération.
7. Annulation, données introuvables et erreurs de DB ne divulguent pas de données sensibles.
8. Un outil en lecture seule compatible avec le registre de l'étape 04 fonctionne sans donner de droits supplémentaires.
9. Les étapes 01 à 04 et les tests métier historiques restent fonctionnels.
10. Une validation du build/DB réel reste nécessaire sur l'environnement équipé des dépendances npm.

## Déploiement

Aucune migration Prisma, aucun nouvel endpoint, aucune modification d'interface. Le Context Engine n'est pas encore appelé par les agents métier en production. Il sera intégré aux nœuds de chaque agent lors de sa migration.
