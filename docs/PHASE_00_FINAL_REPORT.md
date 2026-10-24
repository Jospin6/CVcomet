# CVComet 2.0 — Phase 00 / Livraison cumulative 00.1 → 00.4

**Date :** 24 octobre 2026  
**Statut :** implémentation et tests locaux ciblés terminés. **Validation production NON acquise** : dépendances, PostgreSQL, Stripe et Resend réels non disponibles dans cet environnement.

## 1. Résumé cumulatif

| Lot | Résultat implémenté |
|---|---|
| 00.1 | Codes de confirmation d'email aléatoires, hashés, à durée et nombre d'essais limités; invalidation des anciens codes en clair |
| 00.2 | Quotas IA persistants par utilisateur, heure, jour et mois; réservations atomiques, plafonds d'opérations/tokens; `/api/ai/limits` |
| 00.3 | Email de connexion non modifiable par les formulaires de profil; validation des aperçus de modèles; suppression du binaire dans les listes; contrôle d'accès aux modèles; bornage de requêtes sensibles |
| 00.4 | Compteurs d'authentification persistants et anonymisés, protection CSRF/Origin sur les mutations API, webhook Stripe signé/idempotent/validé, suppression de compte protégée, cascades DB, maintenance des historiques |

## 2. Modifications du lot 00.4

### 2.1 Paiements et abonnements

- La signature Stripe est vérifiée sur le corps **brut**, borné à 512 KiB. Aucune mutation de droits n'est effectuée sur un événement non signé.
- Les IDs des prix Stripe configurés côté serveur déterminent le plan; les métadonnées client ne suffisent pas pour accorder un abonnement.
- `BillingWebhookEvent` enregistre les IDs des événements traités pour bloquer les replays. `Subscription.lastStripeEventCreated` empêche les anciens événements de rétrograder des mises à jour plus récentes; chaque événement récupère aussi l'état Stripe courant.
- Les `checkout.session.completed` doivent correspondre à l'utilisateur, au client Stripe, au plan et aux métadonnées de la souscription créés par notre checkout authentifié.
- Les événements de renouvellement résolvent la souscription par son **identifiant Stripe déjà associé**, jamais par un ID de compte fourni par le client.
- Le checkout bloque la création d'un nouvel abonnement si l'utilisateur possède déjà un abonnement actif/en essai/en impayé, et ajoute des clés d'idempotence Stripe pour le client et la session de checkout.
- Les erreurs réseau ou de base répondent avec un statut rejouable (5xx). Une erreur de configuration des tarifs interrompt volontairement la mutation des droits.
- **Limite à tester en staging :** réceptions simultanées avec `event.created` à la même seconde, changements de prix en cours de cycle, abonnements historiques et répétitions d'événements après 400 jours. Une réconciliation planifiée de l'état Stripe reste recommandée.

### 2.2 Authentification et protection anti-abus

- `AuthThrottleWindow` est en PostgreSQL (pas de compteurs mémoire par instance). Les identifiants email/IP sont indexés par HMAC-SHA256, aucune adresse brute n'est stockée.
- Limites par email par endpoint : connexion (10 / 15 min), inscription (5 / heure), émission d'OTP (6 / heure), confirmation (12 / 15 min), endpoints Better Auth avec email (12 / 15 min). Une erreur 429 permet à l'interface de présenter un message clair.
- Un contrôle IP supplémentaire est possible uniquement si le proxy retire les en-têtes IP clients falsifiés, via `CVCOMET_TRUST_PROXY_IP_HEADERS=true`; sinon l'IP n'est pas prise en compte. **Un WAF/rate limiter en périphérie reste obligatoire**, en particulier pour les requêtes anonymes sans email et le trafic depuis de nombreuses adresses.
- L'endpoint Better Auth reçoit un plafond de 16 KiB par POST et les routes d'authentification historiques ne contournent plus le limiteur PostgreSQL lorsque l'email est fourni.

### 2.3 Mutations API, confidentialité et suppression de compte

- `src/middleware.ts` protège `POST/PUT/PATCH/DELETE` sous `/api/` contre les origines non approuvées et les requêtes navigateur avec cookies mais sans `Origin` en production. Seuls le webhook Stripe signé et le job interne protégé par Bearer sont exemptés.
- Les origines permises doivent être définies explicitement avec `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` et, si nécessaire, `CVCOMET_ALLOWED_ORIGINS` (liste d'origines HTTPS exactes séparées par des virgules). Aucune origine `*` n'est acceptée.
- La suppression de compte standard est **strictement personnelle**, y compris pour un administrateur connecté. Une souscription Stripe toujours facturable bloque la suppression jusqu'à expiration/annulation effective ; un statut indéterminé bloque par défaut.
- Les contraintes FK du schéma garantissent la suppression en cascade des profils et conversations, CV, lettres, messages, expériences, projets, études et certificats; les autres relations utilisateur déjà en cascade restent inchangées.
- Pour une politique RGPD complète, une étape supplémentaire devra traiter export de données, trace des consentements, sauvegardes et politique de rétention des données des prestataires externes : ces éléments ne sont **pas** certifiés ici.

### 2.4 Maintenance

- `npm run maintenance:security` supprime les compteurs expirés et conserve les reçus de webhooks et historiques de quotas pendant environ 400 jours. Planifier l'exécution quotidienne sous une identité serveur disposant de droits minimaux. La rétention et l'audit doivent être adaptés aux exigences réglementaires applicables.

## 3. Validation réellement effectuée

- `npm run test:phase00` : **25/25 tests réussis** (fonctions de politique isolées et gardes statiques; pas des tests HTTP/E2E).
- Transpilation syntaxique TypeScript/TSX via l'outil TypeScript installé : **326 fichiers parcourus, 0 erreur de syntaxe**.
- Cohérence ZIP et liste cumulative des chemins : vérification automatisée avant livraison.
- `npm install` impossible depuis cet environnement (registre NPM injoignable, `EAI_AGAIN`), donc dépendances projet absentes.
- `npx prisma validate`, génération Prisma, `npm run typecheck`, `npm test` complet, `npm run build` : **non validés sur la version finale**.
- Tests HTTP Next.js, DB PostgreSQL réel, Stripe en mode test et Resend envoi réel : **non exécutés**.

## 4. Déploiement de validation obligatoire (staging uniquement)

1. Sauvegarder le code et la base ; extraire le ZIP à la racine du projet en conservant les chemins.
2. Installer des dépendances à partir d'un lockfile reproductible (`npm install` si celui-ci n'existe pas ; créer et conserver `package-lock.json` une fois résolu). Ne pas modifier le gestionnaire de paquets sur un environnement de production non testé.
3. Définir des variables serveur fiables :
   - `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET` (fort), `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`
   - `EMAIL_VERIFICATION_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_CAREER_PRO_PRICE_ID`
   - `AUTH_THROTTLE_HASH_SECRET` (facultatif si Better Auth secret fort), `CVCOMET_ALLOWED_ORIGINS` (si origines supplémentaires), `CVCOMET_TRUST_PROXY_IP_HEADERS` (uniquement avec proxy de confiance)
4. Sur une **copie** PostgreSQL de staging, appliquer **dans l'ordre** :
   - `20261024100000_email_verification_hardening`
   - `20261024120000_ai_quota_windows`
   - `20261024150000_security_phase00_final`
5. Exécuter :
   ```bash
   npm install
   npx prisma validate
   npx prisma migrate deploy
   npx prisma generate
   npm run test:phase00
   npm run typecheck
   npm test
   npm run build
   ```
6. Sur une base PostgreSQL **jetable et isolée**, effectuer le contrôle concurrentiel et les cascades :
   ```bash
   NODE_ENV=test CVCOMET_DB_TEST_ALLOW_WRITES=true npm run test:phase00:db
   ```
   Le script refuse un URL de base qui ne contient pas `test`, `staging` ou `localhost`; **ne jamais l'exécuter sur les données de production**.
7. Vérifier dans un navigateur connecté les routes créant, modifiant et supprimant des ressources avec et sans en-têtes `Origin` légitimes, ainsi que les connexions OAuth et la politique des cookies.
8. En mode test Stripe, contrôler checkout Pro/Career Pro, paiement confirmé, répétition et désordre des événements, abonnement résilié, expiration, suppression d'un compte sans abonnement actif. Contrôler les prix distincts et les métadonnées d'abonnement.
9. Tester par Resend la réception, le renvoi, l'expiration, les codes erronés, la concurrence et la non-divulgation des comptes existants.
10. Mettre un limiteur d'abus/CDN/WAF en amont, programmer la maintenance quotidienne, puis procéder à un déploiement canari observé avant d'ouvrir à tous.

## 5. Critère de clôture

**Phase 00 — Développement local : TERMINÉ.** Tous les lots 00.1 à 00.4 sont inclus dans une seule livraison cumulative.

**Phase 00 — Recette d'environnement / mise en production : À VALIDER.** Ne pas annoncer « prêt pour la production » sans avoir exécuté les migrations, le build et les scénarios Stripe/Resend/PostgreSQL listés ci-dessus. L'étape 01 (architecture CVComet 2.0) peut commencer sur cette base **après intégration** de la livraison; la mise en production reste conditionnelle aux vérifications.

## 6. Règle de livraison cumulative

Le ZIP contient **uniquement l'union** des fichiers créés/modifiés à partir du projet source sur les lots 00.1 → 00.4, à leur chemin relatif original. Les fichiers devenus identiques à la source sont exclus ; le projet initial complet, les données utilisateur, secrets, modules installés et artefacts compilés sont exclus. Toute suppression sera indiquée séparément dans le manifeste.
