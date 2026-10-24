# CVComet 2.0 — Étape 02 / Career Identity & Evidence Vault

**Date :** 24 octobre 2026  
**Statut :** implémentation locale terminée, validation de production conditionnée par la recette PostgreSQL/Next.js.

## Objectif

Construire une mémoire professionnelle privée, structurée et **explicitement approuvée** par le candidat. Le terme « confirmé » veut dire *attesté par son propriétaire* ; il ne constitue PAS une vérification indépendante de diplômes, d'emplois ou de compétences. L'IA n'a aucun droit d'affirmer le contraire.

## Implémentation

1. **Schéma Prisma et migration SQL :** `CareerEvidence` lié au propriétaire (`onDelete: Cascade`), `kind`, `statement`, `source`, `sourceLabel`, `sourceKey`, `status`, `revision`, `confirmedAt`, `revokedAt`, `createdAt`, `updatedAt`. Index de lecture et clé de dédoublonnage par source importée et propriétaire.
2. **Workflow d'approbation :** `DRAFT → CONFIRMED`, `DRAFT → REJECTED`, `REJECTED → CONFIRMED`, `CONFIRMED → REVOKED`. Les confirmations ne sont jamais automatiques. Un edit repasse en `DRAFT` et transforme la provenance en `MANUAL`. Une révocation est définitive pour cette entrée (l'utilisateur peut la supprimer et créer un nouveau fait).
3. **Conflits :** les changements utilisent un `revision` fourni par le client et `updateMany` avec une condition sur `(id,userId,revision,status)` pour empêcher un écrasement concurrent. La suppression respecte aussi la révision.
4. **Routes API v1 :** `GET/POST /api/career/v1/evidence`, `PATCH/DELETE /api/career/v1/evidence/:id`, `POST /api/career/v1/evidence/import-profile`. Authentification obligatoire, identité exclusivement issue de la session, validation Zod `.strict()`, JSON borné (1–4 KiB), contrôle d'origine sur les mutations, `no-store` et réponse enveloppée avec requestId.
5. **Import volontaire :** expériences, formations, projets, certifications, compétences du profil existant, au plus 50 propositions par action. Import `DRAFT` uniquement, avec clé stable. Un import répété ne multiplie pas les mêmes sources. Il ne remplace pas silencieusement le contenu d'une fiche modifiée. La synchronisation différentielle pourra être ajoutée à une étape ultérieure.
6. **Outil IA :** `list_my_confirmed_evidence` ajouté au registre v1. Renvoie au maximum 30 faits et UNIQUEMENT ceux dont le statut est `CONFIRMED`. Les quatre outils précédents sont conservés. `get_my_profile` reste un outil distinct et son contenu est explicitement classé auto-déclaré/non vérifié : lors du développement des générateurs agentiques, ne pas le traiter comme des preuves confirmées.
7. **UI :** `/dashboard/evidence`, menu latéral et commande rapide, textes français/anglais, import volontaire, création, filtre, pagination, approbation, révocation, édition et suppression.
8. **Vie privée :** aucune publication automatique, aucune source externe requise, pas d'ajout automatique au CV, pas de recherche auprès de tiers, aucune révélation inter-comptes. La suppression est définitive pour l'entrée visée ; la suppression complète du compte utilise la cascade de la relation.

## Contrat HTTP — exemples

`GET /api/career/v1/evidence?apiVersion=v1&status=CONFIRMED&limit=25`

`POST /api/career/v1/evidence` avec body JSON :

```json
{"apiVersion":"v1","kind":"SKILL","statement":"Développement avec TypeScript","sourceLabel":"Projet CVComet"}
```

`PATCH /api/career/v1/evidence/:id` avec :

```json
{"apiVersion":"v1","revision":0,"action":"confirm"}
```

Pour corriger un fait, transmettre `revision`, `kind`, `statement`, `sourceLabel?` et `apiVersion:v1` ; le statut revient à `DRAFT`. Pour supprimer, `DELETE` avec JSON `{"apiVersion":"v1","revision":1}`.

Les données sont encapsulées : `{ "apiVersion":"v1", "requestId":"...", "data": ... }`. Erreurs : `UNAUTHORIZED`, `VALIDATION`, `EVIDENCE_NOT_FOUND`, `EVIDENCE_CONFLICT`, `EVIDENCE_TRANSITION_NOT_ALLOWED`, `REVOKED_EVIDENCE_IMMUTABLE`, etc.

## Tests et recette

Les tests `scripts/career-evidence.test.mjs` et `scripts/career-evidence-boundaries.test.mjs` couvrent les transitions et l'import (comportements exécutés), ainsi que les invariants de séparation des comptes et les routes (vérifications structurelles). Exécuter les tests complets :

```bash
npm install
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npm run test:cvcomet:baseline
npm run typecheck
npm run build
```

**N'appliquer les migrations qu'après sauvegarde et sur staging d'abord.** Un test PostgreSQL de fumée optionnel, **non exécuté dans cet environnement**, est fourni pour prouver des contraintes en base, avec une base jetable :

```bash
# Uniquement sur une base de test isolée !
ALLOW_EVIDENCE_DB_TEST=1 CVCOMET_EVIDENCE_TEST_DATABASE_URL='postgresql://.../cvcomet_stage' npm run test:phase02:db
```

Checklist manuelle staging : créer deux comptes A/B ; A crée et confirme un fait ; B ne peut ni lire ni modifier ce fait ; contrôle 401 sans session, 400 avec champs `userId/status/source` inattendus ou grosse payload, 409 sur revision obsolète, 404 sur id étranger, 403 si origine interdite ; importer le profil deux fois et vérifier l'absence de doublons ; modifier un fait confirmé et vérifier que son statut repasse à brouillon ; révoquer puis vérifier qu'il disparaît de l'outil IA ; supprimer et vérifier l'effacement ; supprimer le compte et vérifier la cascade ; vérifier français/anglais/mobile/clavier et la pagination.

## Limites explicites

- La migration, le build Next, les tests HTTP et le smoke PostgreSQL nécessitent une base, les dépendances et les secrets de staging ; pas de certification de production à ce stade.
- Aucun générateur existant de CV ou de lettre n'est encore modifié pour se reposer sur le Vault. Ce sera fait aux étapes 03–04, avec un garde-fou contre les faits inventés.
- Les sources documentaires ne sont pas authentifiées automatiquement et les déclarations restent auto-attestées. Un mécanisme de vérification externe ou de téléversement de justificatifs ne fait pas partie de cette étape.
- Les outils v1 ne sont pas encore reliés à l'orchestrateur LLM : prévu à l'étape 06. Les actions externes demeurent interdites.
- Pour garantir la cohérence avec des modifications futures du profil, il faudra une interface de comparaison/synchronisation ; ici l'import dédoublonne selon l'identité des enregistrements.

## Livraison cumulative

Le ZIP de phase 00 + étape 01 + étape 02 ne contient que les fichiers nouveaux ou modifiés depuis `cvcomet.zip`, conservés à leur chemin relatif d'origine. Les fichiers non touchés du projet source sont exclus ; les précédents correctifs sont tous retenus, au dernier état connu.

**Suite :** Étape 03 — moteur de création et d'édition de CV fondé sur les faits attestés, avec validation explicite des propositions et exports.
