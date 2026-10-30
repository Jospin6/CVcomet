# CVComet 2.0 — Implémentation P0/P1 (29 octobre 2026)

## Périmètre

Cette livraison est un **ZIP cumulatif de fichiers nouveaux ou modifiés** fondé sur le projet fourni. Elle ne constitue pas à elle seule le dépôt source original complet. Les chemins relatifs sont conservés.

### P0-A — CV importés éditables

- La bibliothèque des CV peut recevoir les PDF / DOCX / TXT existants. Après un import unique, elle ouvre l'écran de conversion ; les anciens imports ont également le bouton « Convertir & éditer ».
- `POST /api/resume-documents/[id]/convert` avec `action=preview` : accès propriétaire seulement, extraction du texte PDF ou du `previewText` DOCX/TXT existant, extraction de faits structurés avec une IA configurée, quota IA en vigueur, réponse non sauvegardée comme CV.
- L'écran `/dashboard/resumes/import/[id]` permet de corriger les champs, expériences, formations, projets, certifications, distinctions, liens, puis exige une case de validation.
- Le même endpoint avec `action=confirm` crée un **nouveau CV structuré modifiable**, sans modifier le PDF/DOCX original. Email du CV et champs de contact sont revus ; les distinctions sont conservées dans les certifications avec libellé et les centres d'intérêt dans le résumé.
- En contexte de candidature, le nouveau CV est lié au dossier via `PATCH /api/applications/[id]`, avec annulation du lien de lettre devenu incohérent, puis ouverture du studio.
- **Limite** : les PDF image sans couche texte nécessitent un modèle capable de lire nativement les PDF ; sinon l'API refuse proprement la conversion (`PDF_TEXT_REQUIRED`). Ce chemin dépend de la qualité et disponibilité du fournisseur IA.

### P0-B — Une candidature, un espace de travail

- `/dashboard/applications/[id]` conserve l'onglet dans l'URL, avec retour aux pages du dossier après un passage dans les outils.
- Le contexte `applicationId` est transféré entre bibliothèque de CV, conversion, studio CV, studio lettres, Analyse d'offre, Application Agent, Coach entretiens et Career Agent.
- Les créations CV liées au dossier mettent à jour le dossier ; les modifications de CV ou de poste effacent le lien de lettre incompatible et son snapshot.
- Les analyses d'offre faites depuis un dossier peuvent rattacher l'offre enregistrée au dossier. L'adaptation de CV approuvée et la lettre générée depuis cette vue peuvent être reliées au dossier.
- Aucune candidature à un employeur n'est envoyée automatiquement.

### P0-C — Lettres depuis les modèles

- `/dashboard/cover-letters?template=<id>` lit le modèle sélectionné dans la galerie, et accepte `cvId`, `jobId`, `applicationId`.
- `POST /api/cover-letters/from-template` vérifie les propriétaires du CV, de l'offre et du dossier. Le brouillon de lettre vide hérite d'une composition/design valide, du nom du candidat et de la cible offerte. Il est immédiatement modifiable dans le studio.
- L'offre déjà associée à une candidature est automatiquement reprise si `jobId` est omis. Les associations incohérentes sont refusées.

### P1-A — Find Jobs

- Vue compacte en lignes avec entreprise, intitulé, lieu, contrat, provenance et actions (détails, enregistrer, préparer).
- Filtres visibles sur ville/pays, remote/sur site, type de contrat. Les filtres du panneau s'appliquent **aux résultats de la page chargée** ; les sources d'offres restent susceptibles d'être incomplètes et les compteurs du fournisseur ne représentent pas nécessairement le nombre de lignes après filtrage.
- Le scoring des offres recommandées est isolé dans `src/lib/find-jobs/ranking.ts`, testé indépendamment. Il tient compte de l'intitulé ciblé, du domaine, des compétences déclarées, de l'expérience, des préférences de travail et des restrictions géographiques fournies par les sources. Il n'est ni un classement ATS officiel ni une garantie d'éligibilité.
- « Préparer » crée ou réutilise une candidature et ouvre son espace de travail ; aucune candidature n'est expédiée.

### P1-B — Career Agent contextuel

- Outil en lecture `get_my_application` accessible au planificateur, restreint à l'identité connectée, et contexte de dossier explicite possible sur l'API agent, les conversations temporaires et les missions enregistrées.
- Sur l'écran Career Agent, lorsque le dossier est fourni, l'utilisateur peut préparer une proposition d'amélioration de CV ou de lettre à partir des faits du CV/lettre et des preuves confirmées.
- **Préparer n'applique pas de modifications** : la proposition est stockée temporairement et affichée en comparaison avant/après. L'utilisateur doit explicitement cocher la case de vérification puis choisir « Appliquer » ou « Ignorer » via un endpoint distinct et authentifié. L'expiration, les versions et les propriétaires sont vérifiés par les services de propositions déjà existants.
- Les outils d'envoi d'email, de dépôt de candidature et d'actions externes restent désactivés. La planification libre du chat reste limitée aux **lectures** ; les propositions sont déclenchées par le formulaire de préparation explicite dans l'écran du Career Agent.

## Vérifications locales

Effectuées dans l'archive sans les dépendances npm du projet original :

```bash
node scripts/release-syntax-check.cjs     # 402 fichiers TS/TSX parsés, aucune erreur de syntaxe
npm run test:p0p1                       # 6 tests ciblés réussis
npm run test:cvcomet:baseline           # phases 00–13 réussies
```

Les tests ciblés comprennent deux **tests exécutables** sur le ranking et quatre tests de contrats source. Ces tests ne remplacent pas un test end-to-end avec PostgreSQL et des services externes.

## Obligatoire avant mise en production

1. Fusionner les fichiers de ce ZIP dans le **dépôt CVComet d'origine**, sans supprimer les fichiers absents du ZIP (archive cumulative limitée aux modifications).
2. Depuis le dépôt complet, installer les versions de dépendances du projet, régénérer le client Prisma, appliquer les migrations déjà prévues dans le dépôt et disposer d'un PostgreSQL de test.
3. Exécuter `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:p0p1`, `npm run test:cvcomet:baseline`.
4. Test manuel avec un véritable PDF texte, DOCX, le compte connecté, le fournisseur d'IA configuré : aperçu > correction > confirmation > studio > export PDF/DOCX ; tester aussi un PDF image sans texte pour le traitement d'erreur.
5. Test d'intégration sur au moins deux utilisateurs : l'utilisateur B ne doit pas pouvoir consulter, convertir ou associer les documents et candidatures de A.
6. Test du chemin CV lié au dossier > analyse > lettre modèle > dossier de candidature > entretiens > proposition agent > approbation de version et retour au dossier ; vérifier également conflits et expirations des propositions.
7. Vérifier la performance et les quotas du fournisseur d'offres et du LLM avant de publier. Le classement et les filtres sont des recommandations heuristiques, pas des garanties d'embauche.

**État de validation** : implémenté dans le code et tests locaux disponibles réussis ; build Next.js complet, contrôle de types et recette d'intégration non exécutés dans cet environnement faute des `node_modules`, du verrouillage npm et de la base de données / clés de test. Ne pas présenter la livraison comme « production validée » avant la recette.
