# CVComet 2.0 — Étape 14/14 : Consolidation finale et préparation bêta

**Date : 24 octobre 2026**  
**Statut : développement de l'étape 14 livré et contrôles locaux réalisés ; lancement public international NON AUTORISÉ sans recette staging.**

## Objectif et portée

Cette étape complète les versions déjà livrées (phase 00, étapes 01 à 13) sans les remplacer. La priorité n'est pas d'ajouter un autre générateur, mais de créer une **preuve reproductible de préparation au lancement**, de repérer les limites et d'empêcher que des tests unitaires réussis soient pris pour un feu vert de production.

### Code ajouté ou modifié

- `src/lib/security/origin-policy.ts` : durcissement de l'autorisation des origines ; seules les origines HTTPS explicitement configurées sont acceptées en production. Les origines opaques/non HTTP(S), malformées ou incluant des identifiants sont rejetées. HTTP est limité à l'environnement de développement.
- `src/app/api/health/route.ts` : contrôle public de **vie uniquement** (`GET /api/health`) ; pas d'accès aux secrets, aux modèles, à la base de données ni de prétention à une disponibilité de bout en bout. Réponse non mise en cache.
- `scripts/release-source-audit.cjs` : inspection déterministe des 15 routes Career OS (session, contrôle d'origine sur mutations, enveloppe versionnée), des migrations attendues, des écrans, des limites d'outils et de l'absence d'outil IA externe activé.
- `scripts/release-phase14.test.mjs` : tests complémentaires sur les origines, les contrats de sécurité et le caractère non envoyé des candidatures approuvées.
- `scripts/release-syntax-check.cjs` : contrôle de syntaxe de tous les fichiers TypeScript/TSX, explicitement distinct de `tsc --noEmit`.
- `scripts/release-gate.cjs` : contrôle de lancement avec modes **local** et **staging** ; aucun mode n'affirme une certification de production.
- `package.json` : commandes `test:phase14`, `check:syntax`, `release:audit`, `release:gate`.
- `docs/release/RELEASE_GATES.md`, `docs/release/INTERNATIONAL_BETA_UAT.md`, le présent rapport.

### Vérifications réellement exécutées

- `npm run test:cvcomet:baseline` : les suites ciblées des étapes 00 à 13 passent (**191 tests**).
- `npm run test:phase14` : **4 nouveaux tests réussis**.
- `npm run check:syntax` : **391 fichiers TS/TSX parcourus ; aucune erreur de syntaxe**.
- `npm run release:audit` : audit de source et tests locaux réussis, mais **LOCAL_ONLY**.
- `npm run release:gate` : sortie non nulle, **BLOCKED**, faute de dépendances installées, d'un lockfile vérifié, des variables staging et d'une URL HTTPS de staging. La validation des migrations, le build et les tests HTTP protégés n'ont pas été exécutés.
- `npm run typecheck` : **échec** dans l'environnement actuel, notamment `TS2307 Cannot find module '@prisma/client'` et d'autres modules absents. Cela ne prouve pas que le code compilera une fois les dépendances installées.
- Une tentative de créer un lockfile avec npm a été interrompue faute de réponse du registre dans le délai disponible. **Aucun lockfile valide n'a été généré.**

### Porte bloquée / risques restant à traiter

1. **P0 — Build reproductible :** générer et versionner un vrai lockfile, faire `npm ci`, `prisma generate`, puis `npm run typecheck` et `npm run build` sur CI/staging. Corriger toutes les erreurs de compilation détectées.
2. **P0 — Base & migrations :** sauvegarder PostgreSQL, valider toutes les migrations en staging et vérifier les contraintes de propriété, cascades, rejouabilité, idempotence et concurrence.
3. **P0 — Auth & paiement :** tester Better Auth, la récupération de compte, les limites anti-abus, les webhooks Stripe signés, événements dupliqués/hors ordre, annulations et permissions réelles avec des comptes de test.
4. **P0 — IA réelle :** valider sur les modèles effectivement configurés les plans d'outils, la non-invention des expériences, le refus d'envoi fictif, les limites de coûts et les scénarios d'indisponibilité.
5. **P0 — Isolation des données :** recette avec au moins deux comptes distincts et un admin. Couvrir CV, lettres, missions, preuves, candidatures, facturation, feedback et fichiers.
6. **P1 — UX :** vérification clavier et lecteur d'écran, adaptations mobile/desktop, navigation, thèmes, exports PDF/DOCX, langues et formats pays.
7. **P1 — Aspects internationaux :** revue des mentions légales, conservation et effacement, sous-traitants, transferts internationaux, tarification, facturation et règles locales de candidature. Aucune certification légale n'est donnée ici.
8. **P1 — Bêta :** définir la cohorte, le support, le canal de signalement, la métrique d'erreur et une capacité de rollback avant l'ouverture au public.

### Décision de livraison

**L'étape 14 est livrée pour l'implémentation locale. La préparation du lancement est documentée, pas achevée au sens production.** Aucune publication ou transaction Stripe réelle n'a été effectuée. Le statut de la bêta demeure **NO-GO** tant que les P0 ne sont pas levés et que la recette ci-dessous n'est pas signée.

### Installation et commandes

1. Faire une sauvegarde de la source et de la base. Extraire l'archive cumulative **à la racine du projet original**, en conservant la structure des dossiers et sans retirer les fichiers initiaux inchangés.
2. Créer un lockfile reproductible dans un environnement NPM ayant accès au registre ; versionner celui-ci. Réconcilier les éventuels conflits de dépendances au lieu de forcer leur résolution.
3. Exécuter `npm ci`, `npx prisma validate`, `npx prisma migrate deploy` en staging, `npx prisma generate`.
4. Exécuter `npm run release:audit`, puis `npm run typecheck`, `npm run build` et les tests des différentes APIs.
5. Définir les variables nécessaires (voir `docs/release/RELEASE_GATES.md`) et `CVCOMET_STAGING_URL=https://...`, puis `npm run release:gate` sur un environnement **strictement staging**. Le contrôle d'origine en production exige une URL HTTPS explicite.
6. Effectuer et signer la grille de recette `docs/release/INTERNATIONAL_BETA_UAT.md`, y compris les tests manuels et ceux des fournisseurs. Une sortie positive des scripts ne suffit pas à elle seule à ouvrir la bêta.

## Archive cumulée

Le ZIP final sera produit par comparaison de la source originale `cvcomet.zip` avec le dépôt de travail, puis comparé à l'archive cumulative 00-13. Il ne comporte **que des fichiers nouveaux ou modifiés par rapport au projet de départ**, dans leur dernière version et avec leurs chemins relatifs d'origine. Les dossiers et fichiers d'origine inchangés ne doivent pas être retirés lors de l'extraction.
