# CVComet 2.0 — Étape 11/14 : Career Command Center

Date : 24 octobre 2026. Livraison en développement local ; aucune certification de production.

## Objectif

Transformer les fonctions développées lors des étapes 00 à 10 en un parcours cohérent, mobile et orienté vers la prochaine action, **sans réécrire les moteurs métier, réinitialiser les données ni activer des actions agentiques non autorisées**.

## Livré dans cette étape

1. **Accueil Career Command Center** : nouvelle première section premium, adaptable écran mobile/desktop, avec Hero orienté Career Agent, sécurité, six cartes d'actions (CV, lettres, analyse d'offre, dossiers, entretiens, faits professionnels), et conservation des fonctionnalités préexistantes d'analyse d'offre et des derniers documents.
2. **Indicateurs réels, sans scores fictifs** : nombre de documents basé sur `useResumeLibrary`; nombre de candidatures actives lu depuis `/api/applications` ; nombre de missions **affichées** (limite 30) lu depuis `/api/career/v1/missions`. Les erreurs, l'absence de session et les données invalides restent `null` et s'affichent « — », jamais zéro inventé. Aucune écriture n'est effectuée par ces lectures.
3. **Prochaine action guidée** : connexion si invité, création de premier CV si aucun document, préparation de dossier en présence de candidatures, sinon comparaison CV/offre. Aucun score de préparation ou probabilité d'embauche artificiel.
4. **Career Agent repensé** : en-tête plus clair, accès à Evidence Vault, panneau de missions lisible sur mobile, composer distinct, suggestions FR/EN activables qui remplissent uniquement la zone de texte et demandent toujours un envoi manuel. Les missions privées, leur idempotence, l'historique, l'archivage, les confirmations et les mécanismes de reprise de l'étape 07 restent intacts. Les traces d'outils couvrent aussi les lectures ajoutées aux étapes 08 et 09.
5. **Navigation professionnelle** : accueil puis Career Agent mis en avant, routes enfants reconnues comme actives, liens vers lettres de motivation ajoutés dans la palette, raccourci Agent dans l'en-tête desktop, recherche tolérant les accents et Enter ouvrant l'action qui a le focus. Sous-titre du menu en FR/EN.
6. **Accessibilité et responsive** : liens à libellés explicites, titres hiérarchisés, boutons d'amorçage utilisables au clavier, états chargement/erreur conservés, zones scrollables bornées, `aria-busy` pour le fil de discussion, styles focus, prise en charge des préférences `prefers-reduced-motion` déjà existantes.
7. **Styles UI** : alignement aux variables de thème existantes (`--hero`, `--primary`, `--card`, etc.), faible ajout CSS ; aucun nouveau design system ni composant externe.

## Fichiers principaux

- `src/components/career/career-command-center.tsx` — écran de synthèse, navigation et récupération contrôlée.
- `src/lib/career/command-center.ts` — règles pures de métriques et prochaine étape.
- `src/app/page.tsx` — intégration sans suppression de la recherche d'emploi ni bibliothèque CV.
- `src/app/dashboard/assistant/page.tsx` — amélioration du chat et de la présentation des missions.
- `src/components/shell/navigation.ts`, `src/components/app-sidebar.tsx`, `src/components/shell/app-header.tsx`, `src/components/shell/command-palette.tsx` — navigation et raccourcis.
- `src/app/globals.css` — léger traitement de Hero respectant les thèmes.
- `public/locales/fr/common.json`, `public/locales/en/common.json` — titre/sous-titre du menu.
- `scripts/career-command-center-phase11.test.mjs`, `scripts/career-command-center-boundaries-phase11.test.mjs` — règles testées et garde-fous.
- `package.json` — commande `test:phase11` dans la baseline.

## Tests effectués

- `npm run test:cvcomet:baseline` : **163 tests ciblés réussis sur 163**, 12 sous-suites.
- `npm run test:phase11` : **5 nouveaux tests réussis sur 5**.
- Analyse syntaxique via TypeScript `transpileModule` de **375 fichiers TS/TSX dans `src/`**, aucune erreur de syntaxe. Ceci **n'est pas** une vérification sémantique TypeScript.
- Contrôle d'intégrité ZIP, comparaison au projet original, conservation des chemins précédemment modifiés, empreintes SHA-256 (voir manifeste).

## Limites et validations obligatoires

- Aucun `node_modules` projet complet, base PostgreSQL, session Better Auth ou fournisseur IA réel disponible. Les tests **typecheck**, `next build`, end-to-end navigateur et API avec données réelles doivent être exécutés sur un environnement approprié avant production.
- Ce lot ne crée **aucune migration Prisma**. Les migrations des étapes précédentes doivent déjà être appliquées, en staging d'abord.
- Sur un environnement réel, vérifier : login/logout, absence de métriques en invité, compte sans CV, compte possédant plusieurs CV, erreurs 401/500 des métriques, passage clair/sombre, français/anglais, écran 320 px/tablette/desktop, recherche clavier, missions archivées, historique paginé, conservation des données, et fonctionnement des outils du Career Agent.
- L'analyse d'offre présente sur la page d'accueil demeure disponible et conserve les limites de quotas et d'authentification antérieures. L'agent reste en lecture seule.
- Les métriques sont des nombres de dossiers et de missions accessibles, **pas** un indicateur de chances d'obtenir un emploi.

## Intégration du ZIP cumulatif

1. Sauvegarder code et base ; appliquer le ZIP **à la racine du projet original** (les chemins sont relatifs).
2. Vérifier les variables d'environnement et les migrations nécessaires aux étapes 00–09 ; l'étape 11 n'ajoute aucune migration.
3. En staging : `npm install`, `npx prisma validate`, `npx prisma migrate deploy`, `npx prisma generate`, `npm run test:cvcomet:baseline`, `npm run typecheck`, `npm run build`.
4. Corriger toute anomalie du build ou de la recette navigateur avant de déployer.

## Étape suivante

Étape 12/14 : Business Model & Monetization. Auditer et sécuriser plans, quotas, crédits, coûts par opération IA et expérience d'abonnement, en conservant exactement le protocole ZIP cumulatif.
