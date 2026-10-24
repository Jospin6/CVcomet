# CVComet 2.0 — Étape 04/14 — Rapport de livraison

**Intitulé :** AI Cover Letter Studio 2.0  
**Date :** 24 octobre 2026  
**Statut :** implémentation locale terminée ; homologation production non effectuée.

## Travaux réalisés

- Route de l'assistant de lettres refondue : suppression de l'écriture automatique à chaque réponse IA.
- Proposition persistante, isolée, explicite et limitée à 15 minutes ; récupération d'un brouillon après rechargement.
- Comparaison `avant/après`, actions **Accepter** / **Rejeter**, et messages de conflits dans le studio FR/EN.
- Trois amorces de rédaction : plus naturel, plus concis, plus centré sur le poste.
- Verrouillage côté serveur des identifiants, de l'employeur, du titre visé, du destinataire et de la signature.
- Relecture des faits `CareerEvidence` confirmés par leur propriétaire ; garde-fous numériques et techniques ; suivi de leurs révisions.
- Verrouillage transactionnel avec comparaison de la révision du document au moment de l'acceptation.
- Incrémentation de révision lors de régénérations de lettres existantes pour rendre les propositions périmées inapplicables.
- Prise en charge des lettres sans CV associé par les routes de lecture/studio, à condition que leur conversation appartienne à l'utilisateur.
- Migration Prisma `20261024210000_cover_letter_ai_proposals` et contrat d'architecture dans `docs/architecture/COVER_LETTER_AI_V1.md`.

## Modifications majeures

| Chemin | Utilité |
|---|---|
| `prisma/schema.prisma` | Modèle `CoverLetterAIProposal`, relations et enum |
| `prisma/migrations/20261024210000_cover_letter_ai_proposals/migration.sql` | Table transactionnelle, index, contraintes et cascades |
| `src/lib/cover-letter-ai/review.ts` | Comparaisons, identité verrouillée, heuristiques factuelles |
| `src/lib/cover-letter-ai/proposal-service.ts` | Proposer, restaurer, accepter ou rejeter sous contrôles transactionnels |
| `src/app/api/cover-letters/[id]/assistant/route.ts` | GET/POST sans sauvegarde directe dans la lettre |
| `src/app/api/cover-letters/[id]/assistant/decision/route.ts` | Décision authentifiée, bornée et vérifiée |
| `src/components/resumes/cover-letter-studio.tsx` | Comparaison, approbation, rejets, suivi de révision |
| `src/lib/career/job-documents.ts` | Incrément de révision lors de sauvegardes générées |
| `src/app/api/cover-letters/[id]/route.ts` | Propriété vérifiée via conversation, même sans CV lié |
| `scripts/cover-letter-ai-*.mjs` | Tests ciblés |
| `scripts/cover-letter-ai-phase04-db-smoke.cjs` | Vérification read-only en staging uniquement |
| `package.json` | Scripts de tests phase04 et tests cumulatifs |

## Vérifications réelles

- Étape 00 : **25/25** tests ciblés, locaux.
- Étape 01 : **14/14** tests ciblés, locaux.
- Étape 02 : **12/12** tests ciblés, locaux.
- Étape 03 : **14/14** tests ciblés, locaux.
- Étape 04 : **19/19** tests ciblés, locaux.
- **Total 84/84 tests ciblés passés** (tests unitaires et tests de frontières du code, pas de validation bout-en-bout).
- Analyse syntaxique TypeScript/TSX sans diagnostic (transpilation uniquement, pas le typecheck sémantique).

## Points non vérifiés ici

- Aucun service PostgreSQL, fournisseur IA ou serveur Next.js réel n'a été lancé pour cette étape.
- Pas de migration effectivement appliquée à une base PostgreSQL.
- Pas de `prisma validate` / `prisma generate`, `npm run typecheck`, ni de build Next.js complet : dépendances absentes de l'archive source.
- Aucune garantie de déploiement production à ce stade.
- Une vérification humaine du contenu reste obligatoire : les heuristiques ne détectent pas tous les faits inventés.

## Installation (en environnement de test)

Après sauvegarde de la base et du projet, extraire le ZIP cumulatif **à la racine** du dépôt `cvcomet`, puis :

```bash
npm install
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npm run test:cvcomet:baseline
npm run typecheck
npm run build
```

Exécuter facultativement le smoke test **lecture seule**, uniquement sur une base dont le nom contient `test`, `stage` ou `staging` :

```bash
ALLOW_COVER_LETTER_AI_DB_TEST=1 CVCOMET_COVER_LETTER_AI_TEST_DATABASE_URL=postgresql://.../cvcomet_staging npm run test:phase04:db
```

Vérifier ensuite en navigateur : création lettre, modification manuelle, proposition de réécriture, aperçu, refus, approbation, concurrent modification, révocation d'un fait, expiration de 15 minutes, retour après rechargement, rendu PDF.

## Prochaine phase

**Étape 05 — Global Career Localization** : normes pays/secteur, paramètres de candidature, langues et conformité documentaire. La livraison devra toujours contenir les fichiers modifiés cumulés des étapes 00 à 05 uniquement.
