# CVComet — Portes de validation avant bêta

## Deux niveaux distincts

### Local : `npm run release:audit`

- Vérifie le code source des contrats Career OS et l'existence des migrations.
- Exécute les suites ciblées des étapes 00 à 13 et les tests de l'étape 14.
- Analyse la syntaxe des fichiers `.ts` et `.tsx` avec TypeScript disponible localement.
- Affiche le statut **LOCAL_CHECKS_PASSED_NOT_PRODUCTION_CERTIFIED** si les contrôles locaux passent.
- Signale le lockfile et les dépendances manquants, sans en déduire qu'un build est possible.
- Peut enregistrer le rapport sans secret : `node scripts/release-gate.cjs --local --output=/chemin/validation.json`.

### Staging : `npm run release:gate`

Le contrôle staging est **bloquant** : il exige d'abord les tests locaux, une installation reproductible avec lockfile, les dépendances, les secrets d'application et une URL HTTPS de staging. Lorsque ces prérequis existent, il lance :

- `prisma validate` et `prisma migrate status` ; **status ne remplace pas migrate deploy**.
- `npm run typecheck`.
- `npm run build`.
- Des appels non authentifiés à `/api/health`, `/api/career/v1/tools`, `/api/career/v1/missions`, `/api/career/v1/evidence` ; les trois derniers doivent répondre `401` et ne jamais exposer de ressources privées.

Variables requises pour le contrôle staging (valeurs jamais imprimées) : `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_CAREER_PRO_PRICE_ID`, `CVCOMET_STAGING_URL`. Les identifiants réels des fournisseurs IA sont gérés par l'application et leur vérification exige une recette supplémentaire. Les URLs de production doivent être HTTPS, et les origines multiples autorisées doivent être explicitement renseignées dans `CVCOMET_ALLOWED_ORIGINS`.

**Le script n'effectue aucun checkout réel, aucune connexion aux comptes d'utilisateurs ni aucune génération IA réelle.** L'obtention de toutes les vérifications techniques ne signifie pas certification juridique ou qualité des contenus générés.

## Décision go / no-go

Un lancement bêta ne peut recevoir le feu vert que si :

1. Les suites locales passent et un build Next.js réel a réussi avec des dépendances verrouillées.
2. Les migrations sont réellement appliquées sur une base de test et vérifiées ; les backups sont restaurables.
3. Les parcours avec plusieurs comptes montrent une isolation stricte des données.
4. La facturation Stripe et les limites d'usage IA ont été testées avec les fournisseurs actifs.
5. Un jeu représentatif de CV/lettres et d'offres a fait l'objet d'une évaluation humaine avec critères de qualité, exactitude et provenance.
6. Les principaux écrans et exports sont validés sur des navigateurs et appareils représentatifs.
7. Les obligations de protection des données et les textes légaux sont revus avec les personnes compétentes.
8. Les métriques d'incident, contacts support, sauvegardes et procédure de rollback sont définis.

Le contrôle est réexécutable et doit être relancé après tout changement significatif du code ou de la configuration. La checklist de recette signée fait foi pour les tests externes non automatisés.
