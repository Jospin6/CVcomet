# CVComet 2.0 — Étape 09/14 : Application Agent

**Date : 24 octobre 2026. Développement local terminé ; production non certifiée.**

## Objectif

Préparer et faire valider un dossier de candidature complet à partir des actifs existants (offre, CV, lettre, mission et Evidence Vault), sans perdre les travaux des étapes 00–08 et sans activer d'actions externes avant qu'un système d'exécution contrôlé ne soit disponible.

## Livré

1. Nouvelle table et migration Prisma `20261025010000_career_application_packets`. Brouillons persistants, révisions CAS, statut approuvé/annulé et références aux versions des documents sources.
2. API Career OS v1 : sélection des ressources autorisées ; création rejouable par requête ; listing ; édition ; approbation avec relecture des sources en transaction sérialisable ; suppression. Lecture détaillée privée, sans divulgation du jeton d'idempotence ni de son empreinte.
3. Brouillon d'email professionnel par défaut en français ou anglais, construit de manière déterministe et sans allégation professionnelle non documentée.
4. Suggestion IA **sur demande uniquement** : faits utilisateurs confirmés, plafond de tokens, contrôle des quotas existants, vérification automatique conservatrice, retour sans écriture. Approbation humaine obligatoire.
5. Nouvelle interface `/dashboard/application-agent`, entrée dans la navigation et lien depuis Job Tracker : dossier, email, CV, lettre, génération facultative, validation, liste et reprise.
6. Outil `list_my_application_packets` de Career Agent, en lecture seule et limité à des métadonnées ; aucune exposition des emails dans le contexte du LLM.
7. Documentation architecture et tests des politiques pures + contrôles de frontières statiques.

## Garanties exactes

- `READY` signifie *dossier approuvé* et **n'indique jamais qu'une candidature est envoyée**. L'agent ne dispose d'aucune permission d'email sortant ou de soumission d'un formulaire.
- Les enregistrements sont accessibles uniquement via l'identité de session et les relations possédées ; aucun payload ne choisit l'identité du propriétaire.
- Toute proposition IA peut contenir des imperfections : la vérification automatique n'est pas une attestation factuelle, légale ou d'employabilité.
- Les changements après préparation invalident l'approbation d'un brouillon et sont signalés sur les dossiers déjà approuvés.
- Une suppression de CV/offre/lettre supprime les paquets qui y étaient associés, évitant les documents orphelins.

## Validation locale / limites

- `npm run test:phase09` : 12 tests ciblés (politique et vérifications d'intégration statiques) réussis.
- `npm run test:cvcomet:baseline` : toutes les suites locales des étapes 00–09 exécutées ; détails dans le journal d'exécution. Les suites historiques ne couvrent pas toute l'API en situation réelle.
- Analyse syntaxique des fichiers TypeScript/TSX avec TypeScript global : 372 fichiers, aucune erreur de syntaxe ; **ce n'est pas une vérification sémantique des types**.
- Migration produite mais non appliquée à une base réelle. Aucune connexion à PostgreSQL/Better Auth, aucun essai E2E navigateur ni aux fournisseurs IA réels. Le build Next.js complet et la validation des types Prisma exigent l'installation des dépendances.
- Le ZIP cumulatif contient uniquement les fichiers distincts du `cvcomet.zip` original, avec les modifications courantes et toutes les étapes précédentes. Manifeste SHA-256 livré.

## Recette staging indispensable

1. Sauvegarder les sources originales et la base de données. Décompresser le ZIP cumulatif à la racine du dépôt d'origine (ne pas substituer le ZIP à un dépôt complet).
2. Installer les dépendances via un lockfile contrôlé, puis `npx prisma validate`, `npx prisma migrate deploy`, `npx prisma generate`.
3. Exécuter `npm run test:cvcomet:baseline`, `npm run typecheck` et `npm run build`. Corriger tout échec réel avant déploiement.
4. Tester deux comptes distincts : l'option, le détail, le patch, l'approbation et la suggestion IA d'un dossier d'un autre compte doivent être interdits.
5. Rejouer exactement le même `requestKey` et les mêmes ressources : un seul dossier ; changer la cible avec la même clé : 409.
6. Tester deux approbations simultanées, un changement de version CV/lettre/offre, un brouillon expiré par changement source, une mission archivée, un CV supprimé et les erreurs de réseau pendant création.
7. Vérifier que l'IA ne se lance que sur clic, respecte les quotas et ne sauvegarde pas les propositions avant validation ; tester des offres contenant des instructions malveillantes et des affirmations non étayées.
8. Vérifier qu'aucun email ne part, que les statuts `JobApplication.APPLIED` ne changent pas et que le copier-coller des documents reste une action manuelle.
9. Confirmer les politiques de conservation et suppression des données personnelles selon les pays ciblés avant ouverture internationale.

## Étape 10

Interview Coach avancé : entretien contextuel, notation qualitative expliquée, historique et progression ; continuer les mêmes exigences d'authentification, conservation et livraison ZIP cumulative.
