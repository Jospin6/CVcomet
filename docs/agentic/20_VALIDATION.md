# Étape 20 — validation finale et matrice de go/no-go

## Vérifié hors ligne

- Tests du routage progressif, interruptions, choix de cohorte stable, refus de configuration et sécurité du legacy.
- Tests de comparaison des métriques, échantillons insuffisants et inconnus historiques non reclassifiés.
- Tests contractuels des API de l'assistant et contrôle administrateur des statistiques.
- Analyse syntaxique des fichiers TS/TSX de la base reconstituée.
- Non-régression de la matrice 01–20.
- Archive cumulative construite par comparaison exacte avec `cvcomet(3).zip` et l'étape 19 ; SHA-256 vérifiés.

## À effectuer avant mise en production (preuves non obtenues ici)

1. Vérifier la présence et le contenu du **lockfile npm**, installer les modules, `npx prisma generate`.
2. Déployer les migrations PostgreSQL 17, 18, 19, 20 sur Neon **staging** et vérifier indexes, relations, suppression de compte et sauvegarde/rollback.
3. Exécuter **tous** les tests `:integration` sur la vraie version de `@langchain/langgraph`, `npm run typecheck`, `npm run build` et un E2E du navigateur sur les routes existantes.
4. Utiliser deux vrais comptes de test pour les refus inter-utilisateurs, revocation mémoire, sessions simultanées, et les actions sensibles nécessitant approbation humaine.
5. Tester LiveKit avec consentement, transcription, fin d'appel interrompue et absence de note fabriquée.
6. Tester `legacy`, `rollout 0/5/25/50/100`, `graph` et `kill_switch` entre déploiements sans doublon de facturation. Sur les missions existantes, ne pas perdre l'idempotence ou l'historique.
7. Auditer métriques comparatives par moteur, latences, coût fournisseur, pannes et taux d'échec; au moins 30 cas et 30 réponses terminées échantillonnées par groupe pour la comparaison opérationnelle.
8. Revoir la factualité de réponses réelles avec un ensemble annoté, consenti, multilingue et des évaluateurs humains.
9. Signer formellement la décision de déploiement après revue des vulnérabilités et de la confidentialité.

**Aucun taux de succès aux tests locaux ne signifie une certification en production.** Tant que ces points restent incomplets, la décision est `NO-GO / NEEDS_STAGING_REVIEW`.
