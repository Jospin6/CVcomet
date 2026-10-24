# CVComet 2.0 — Étape 03/14 : AI Resume Engine 2.0

**Date :** 24 octobre 2026  
**Statut :** livrable local implémenté ; tests unitaires ciblés réussis ; **recette PostgreSQL et build de production non exécutés**.

## Objectif et portée réelle

Faire du studio CV un outil où l'IA **propose** des modifications sans les enregistrer silencieusement, en se basant sur le CV détenu par le candidat et les déclarations de son **Evidence Vault confirmées par leur propriétaire**. Ajouter un export DOCX basique, accessible et éditable sans service tiers ; maintenir l'export PDF existant.

Le terme *confirmé* désigne une déclaration approuvée par l'utilisateur ; **pas une certification indépendante**. Il ne garantit pas qu'une phrase rédigée par le LLM soit exacte. C'est pourquoi l'utilisateur doit relire et accepter chaque proposition avant son application.

## Implémentations livrées

1. **Propositions persistantes (`ResumeAIProposal`) :** migration PostgreSQL et modèle Prisma, relation avec compte et CV avec suppression en cascade. Statuts `PENDING`, `APPLIED`, `DISCARDED`, expiration après 15 minutes, baseRevision, modifications limitées, résumé, version des faits utilisés, horodatage.
2. **API en deux temps :** `POST /api/cvs/:id/assistant` analyse la demande, génère des modifications validées et renvoie `status=proposal`, `proposalId`, `preview`, `diff`, `baseRevision`. **Aucune écriture sur le CV n'est effectuée.** `status=clarification` n'enregistre rien non plus.
3. **Acceptation/rejet :** `POST /api/cvs/:id/assistant/decision` avec `{ "proposalId": "uuid", "action": "accept" | "discard" }`. Session et origine vérifiées. En cas d'acceptation, transaction atomique contrôlant propriétaire, état, expiration, révision du CV et révisions des preuves confirmées. La mise à jour enregistre une version du CV précédent. Le refus laisse le CV intact. Une proposition traitée ne peut pas être rejouée.
4. **Coffre professionnel :** seuls les faits `CONFIRMED` sont passés comme éléments approuvés à la génération conversationnelle. Les éléments non confirmés du profil ne le sont plus. Le texte déjà présent dans le CV reste une donnée auto-déclarée par l'utilisateur, sans statut de vérification externe.
5. **Garde-fou chiffré :** rejet de nouveaux nombres quantifiés et dates introduits par un champ IA sans correspondance dans le CV, les faits confirmés ou l'instruction explicite. Une offre d'emploi liée ne devient **jamais** une preuve de compétences du candidat. Cette vérification est nécessaire mais non suffisante pour détecter toute hallucination : une relecture humaine demeure obligatoire.
6. **Studio conversationnel :** comparaison *avant / après* par champ, aperçu visuel non éditable, bouton **Accepter** et **Rejeter**, suppression de la proposition locale après modification manuelle, désactivation de nouvelles requêtes conversationnelles pendant une décision en suspens, messages français/anglais.
7. **Générateur IA mono-champ :** vérifie désormais le coffre `CONFIRMED`, au lieu d'injecter automatiquement tout le profil dans le prompt ; vérifie aussi les nouveaux chiffres. Son ancien workflow *générer → appliquer* dans l'éditeur reste soumis à un clic explicite.
8. **Export DOCX :** nouvel endpoint authentifié `GET /api/cvs/:id/export/docx?language=fr|en`. Produit localement un paquet Word OOXML avec sections, titres, styles, dates, coordonnées, ordre/visibilité, accents et format A4 ou US Letter. Sortie sans macro, sans liens externes actifs, échappement XML, `no-store`, nom de fichier assaini. Bouton DOCX dans le studio ; PDF existant conservé.
9. **Rétention :** nettoyage automatisable des propositions expirées depuis plus de 30 jours via `npm run maintenance:security`.

## Contrats de l'API de proposition

Exemple d'entrée :

```json
{"instruction":"Raccourcis mon résumé sans inventer de statistiques","language":"fr","revision":3}
```

Réponse proposée :

```json
{"status":"proposal","proposalId":"<UUID>","baseRevision":3,"preview":{"...":"document CV structuré"},"diff":[{"field":"summary.0","before":"Ancien texte","after":"Texte suggéré"}],"changes":["Résumé raccourci"],"expiresAt":"<ISO-8601>"}
```

> Les champs `preview` et `diff` sont réservés à l'utilisateur authentifié ; aucune sauvegarde n'en résulte. La décision ne transmet **aucun texte réécrit par le navigateur**. Le serveur recharge la proposition et recalcule le résultat à partir de ses opérations validées.

Refus : `POST .../decision` avec `{"proposalId":"<UUID>","action":"discard"}`. En cas de révision périmée, expiration, retrait d'une confirmation utilisée ou tentative répétée : erreur 409 et aucune modification du CV.

## Validation exécutée

- 25 tests phase 00 ; 14 tests étape 01 ; 12 tests étape 02 ; 14 nouveaux tests étape 03. **Total : 65/65**.
- Vérification syntaxique TypeScript/TSX : **347 fichiers analysés, aucune erreur de parsing**.
- Tests DOCX vérifiant les entrées ZIP, les fichiers OOXML attendus, l'échappement XML, les sections A4/Letter, la conservation des textes, l'exclusion des sections masquées.
- Comparaison du code à l'archive originale : seul l'ensemble des fichiers **nouveaux ou réellement modifiés** est livré, précédentes phases incluses.

### Non exécuté ici

- `npm install`, `npx prisma validate`, `prisma migrate deploy`, `prisma generate`, `npm run typecheck`, `npm run build` : dépendances de l'application absentes et registre NPM non disponible dans la session.
- Tests HTTP de bout en bout avec comptes réels, concurrence PostgreSQL, configuration fournisseur IA actif, vérification visuelle dans Microsoft Word et export PDF réel.
- Les contrôles automatiques sur le contenu ne vérifient **pas** la vérité de toutes les affirmations, la légalité locale des formats, ni un score ATS garanti.
- L'export DOCX est volontairement **une composition une colonne, modifiable et ATS-compatible par conception** ; il ne reproduit pas au pixel près les compositions PDF ou les modèles visuels multi-colonnes. Le rendu DOCX de qualité éditoriale avancée reste un perfectionnement ultérieur.

## Déploiement sur environnement de test

Exécuter à la racine du **projet original** après extraction du ZIP cumulatif, avec sauvegarde de la base et environnement staging :

```bash
npm install
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npm run test:cvcomet:baseline
npm run typecheck
npm run build
```

Smoke DB **lecture seule** sur base de test isolée :

```bash
ALLOW_RESUME_AI_DB_TEST=1 CVCOMET_RESUME_AI_TEST_DATABASE_URL='postgresql://.../cvcomet_stage' npm run test:phase03:db
```

### Recette manuelle obligatoire

- Deux comptes A et B, avec deux CV ; B ne peut consulter, générer ni approuver une proposition appartenant à A.
- Proposer une modification et confirmer que la révision CV et le nombre de versions ne changent pas avant approbation ; rejeter et confirmer l'absence d'écriture.
- Accepter une fois, vérifier la nouvelle version et le CV ; ré-accepter le même ID retourne 409.
- Ouvrir deux onglets et changer le CV dans l'un avant d'accepter dans l'autre ; la proposition devient périmée (409) et le CV n'est pas écrasé.
- Révoquer un fait confirmé après création de proposition ; l'acceptation doit échouer (409).
- Introduire une statistique dans une offre d'emploi, puis demander à l'IA de prétendre que le candidat l'a réalisée : contrôle de chiffres et relecture.
- Rejeter les requêtes sans session et tester les origines croisées et entrées JSON invalides.
- Exporter et ouvrir Word en anglais et français, en A4 et Letter, sur de vraies données, et comparer manuellement au PDF.
- Vérifier le responsive et l'accessibilité clavier sur l'aperçu et les contrôles d'approbation.

## Livrable et suite

Livraison **cumulative** des phases 00 à 03, dans les chemins du projet source. Pas de projet complet, pas de fichiers originaux inchangés. Étape suivante **04/14 : AI Cover Letter Studio 2.0**, en réutilisant Evidence Vault et le workflow de propositions vérifiées.
