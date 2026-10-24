# CVComet 2.0 — Phase 00 / Lot 00.1

**Statut :** code modifié + tests unitaires isolés réussis ; **non validé en production**.

## Changements inclus

- Codes à six chiffres générés avec `crypto.randomInt` (plus de `Math.random` dans le flux).
- HMAC-SHA256 des codes avec clé serveur dédiée (ou Better Auth secret suffisamment robuste).
- Expiration après dix minutes, maximum cinq tentatives, délai d'une minute entre émissions.
- Écritures conditionnelles `updateMany` pour limiter les courses concurrentes.
- Réponse générique pour éviter la découverte d'adresses inscrites lors de la demande et du renvoi.
- Invalidations des anciens codes en clair dans la migration.
- Les champs techniques d'OTP ne sont pas renvoyés par `sanitizeUser`.
- Tests unitaires de validation, génération et vérification cryptographique.

## Avant d'appliquer en production

1. Faire une sauvegarde de la base PostgreSQL et appliquer la migration `20261024100000_email_verification_hardening` dans un environnement de test, puis en production selon la procédure de déploiement.
2. Configurer `EMAIL_VERIFICATION_SECRET` avec une valeur forte et stable (32 caractères minimum, générée aléatoirement). Elle ne doit **jamais** être publiée ou exposée dans le frontend. L'ancien `BETTER_AUTH_SECRET` est un repli, pas le choix recommandé.
3. Vérifier `RESEND_API_KEY` et `RESEND_FROM_EMAIL` puis tester un email de vérification de bout en bout.
4. Vérifier que le schéma généré Prisma correspond au nouveau schéma (`npx prisma generate`).
5. Vérifier le parcours d'inscription Better Auth, la coexistence des endpoints et la politique réelle de vérification email avant de rendre cette vérification obligatoire.
6. Ajouter un limiteur **distribué** par IP et par compte, résistant aux invocations serverless, et des métriques de livraison email ; un simple cooldown par utilisateur n'est pas un anti-spam global.
7. Ajouter des tests d'intégration PostgreSQL et tests HTTP pour absence d'énumération, concurrence, expiration, verrouillage, et restauration.

## Commandes locales de validation (Node.js 22+)

```bash
npm run test:email-verification
npx prisma validate
npx prisma migrate deploy
npm run typecheck
npm test
npm run build
```

Les cinq dernières commandes nécessitent l'installation des dépendances et, pour les migrations et tests d'intégration, des variables d'environnement/base configurées. **Elles ne sont pas déclarées validées dans cette livraison**.

## Fichiers modifiés / créés

- `prisma/schema.prisma`
- `prisma/migrations/20261024100000_email_verification_hardening/migration.sql`
- `src/lib/auth/email-verification-code.ts` (nouveau)
- `src/lib/auth/email-verification-service.ts` (nouveau)
- `src/app/api/verify-email/route.ts`
- `src/app/api/resend-code/route.ts`
- `src/app/api/confirm-email/route.ts`
- `src/lib/auth.ts`
- `src/lib/utils.ts`
- `scripts/email-verification.test.mjs` (nouveau)
- `package.json`
- `docs/CVCOMET_2026_2027_ROADMAP.md` (nouveau)
- `docs/PHASE_00_DEMARRAGE.md` (nouveau)
