# CVComet 2.0 — Cover Letter AI V1 (étape 04)

## But

Le texte généré par un LLM est une **proposition**. Aucune modification persistante de lettre n'a lieu avant l'action explicite `accept` de son propriétaire. Un utilisateur peut `discard`, ou laisser expirer la proposition après quinze minutes.

## Parcours

1. `POST /api/cover-letters/:id/assistant` : contrôle d'origine, session, propriété de la conversation, révision attendue, taille de requête. Consulte au plus 30 faits `CareerEvidence` en statut `CONFIRMED` appartenant à l'utilisateur. Réserve un quota d'IA avant génération.
2. Le modèle traite l'offre comme donnée non fiable. Il rédige des paragraphes et des propositions de design. Les champs de destinataire, d'entreprise, de poste et de signature sont restaurés systématiquement depuis l'original. Si l'instruction n'est pas visuelle, le design ne change pas.
3. Le serveur refuse les nombres nouveaux absents du texte initial ou de faits confirmés, ainsi que certaines compétences techniques exigées par l'offre mais absentes des sources autorisées. Ces contrôles sont des **heuristiques de précaution**, non une garantie d'absence de toutes les hallucinations.
4. Une transaction vérifie que la révision est toujours d'actualité et que les références aux faits restent confirmées. Le document proposé est conservé dans `CoverLetterAIProposal`, jamais dans `CoverLetter`.
5. Le studio affiche une comparaison `avant/après`. `GET /api/cover-letters/:id/assistant` permet de retrouver la proposition en cours après rechargement (si elle n'a pas expiré).
6. `POST /api/cover-letters/:id/assistant/decision` avec `{proposalId, action:'accept'|'discard'}` vérifie l'origine et la session. Le `accept` s'exécute dans une transaction, exige la même révision et revérifie le statut/la révision des faits. Un `updateMany` conditionnel incrémente la révision du document. `discard` ne touche pas la lettre.
7. Les modifications manuelles préexistantes et la régénération d'une lettre existante incrémentent également la révision; une vieille proposition ne peut pas écraser le travail d'un autre onglet.

## Protection et limites

- Aucune opération d'envoi de candidature ni de contact d'un employeur. La fonctionnalité reste un éditeur local assisté.
- L'attestation d'un fait par son propriétaire **ne constitue pas une vérification tierce**.
- Les contrôles de chiffres et de mots techniques ne couvrent pas toutes les affirmations non numériques ; validation humaine requise avant candidature.
- 15 minutes de durée de vie ; statut `PENDING`, `APPLIED` ou `DISCARDED` ; suppression automatique avec le compte/la lettre. Nettoyage périodique des anciennes propositions possible dans une étape d'exploitation.
- Les contrôles sont côté serveur : le navigateur ne peut pas envoyer un document alternatif à l'endpoint d'approbation.
- L'appel de génération peut échouer sans affecter la lettre existante, mais le quota IA consommé n'est pas nécessairement remboursé.

## API

| Méthode | Chemin | Fonction |
|---|---|---|
| GET | `/api/cover-letters/:id/assistant` | Récupérer une proposition encore valide et sur la bonne révision |
| POST | `/api/cover-letters/:id/assistant` | Générer un brouillon de proposition, sans mutation de lettre |
| POST | `/api/cover-letters/:id/assistant/decision` | Appliquer ou rejeter une proposition existante |

Les requêtes invalides, expirées, non autorisées ou obsolètes renvoient des erreurs normalisées (`401`, `403`, `404`, `409`, `422`). Une nouvelle migration Prisma est nécessaire.

## Recette staging

- Exécuter migrations 00–04 dans l'ordre, puis `prisma generate`.
- Tester utilisateur A vs utilisateur B, deux onglets modifiant la même lettre, proposition expirée, fait révoqué, tentative de réutilisation d'une proposition, message LLM refusé, quotas atteints.
- Tester conservation après rechargement et rejet, régénération d'une lettre existante, parcours mobile et PDF existant.
- Valider `npm run typecheck`, `npm run build` et tests de la base avec les dépendances installées.
