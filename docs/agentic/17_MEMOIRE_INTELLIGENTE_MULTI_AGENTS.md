# CVComet / LangGraph — Étape 17/20 : mémoire intelligente multi-agents

## Objectif et état

Implémenter **une mémoire durable explicite et contrôlable** après le Career Assistant Supervisor (étape 16) sans copier automatiquement les CV, les descriptions de postes, les messages, les transcriptions ni les documents. Les anciennes données métier restent les sources de vérité. L'étape 17 est **implémentée avec tests locaux** mais attend les tests d'intégration avec les dépendances installées et la recette sur Neon.

## Les quatre formes de continuité

1. **Court terme :** les conversations existantes fournissent au Career Assistant les six dernières interactions complétées, bornées en longueur (`mission-policy.ts`). Aucune seconde copie de transcript n'est créée.
2. **Contexte professionnel :** le moteur de contexte de l'étape 05 et les services métier continuent à charger le profil et les documents autorisés, sur demande. Les préférences mémorisées ne constituent jamais une preuve professionnelle.
3. **Préférences explicites inter-missions :** sept clés strictement contrôlées (`response_language`, `response_style`, `target_role`, `target_country`, `target_industry`, `work_mode`, `cv_market`), avec une valeur de 120 caractères maximum. Une préférence n'existe qu'après action volontaire de sauvegarde.
4. **Continuité de mission :** à partir d'un `missionId` déjà validé par le serveur, l'agent retrouve le titre, la révision, le statut et les comptes de runs complétés/approbations en attente, sans recopier les réponses. Les analyses et entretiens existants continuent à vivre dans leurs tables d'origine; aucune mémoire automatique n'en est tirée.

## Graphe

`memory.context → memory.read → memory.verify → END`

- Exécution LangGraph éphémère, **sans checkpointer**. L'agent ne fait que lire.
- L'identité vient de la session serveur, jamais d'un prompt, d'un outil IA ou du corps HTTP.
- Lecture de la table `CareerAgentMemory` filtrée obligatoirement par `userId` et `allowedAgents` ; en présence d'une mission, `CareerMission` est filtrée par `id` **et** `userId`.
- Les observations de run n'enregistrent que les métadonnées de suivi, jamais les valeurs de préférence.
- Une requête distincte relit la mémoire à chaque tour : la correction, la suppression et la révocation sont visibles à la prochaine exécution.
- Le graphe n'autorise aucune modification de profil, de CV, ni d'email/candidature.

## Agents effectivement connectés

| Agent | Lecture de mémoire | Limites |
|---|---|---|
| Career Assistant Supervisor | Oui, si scope `supervisor` coché | Reprend les préférences et l'état de la mission active sélectionnée ; la mémoire des aspirations n'est pas utilisée comme preuve ATS/Job Match |
| Resume Agent | Oui, si scope `resume` coché | Uniquement dans l'appel du modèle de génération réel ; l'éditeur et l'approbation restent identiques |
| Cover Letter Agent | Oui, si scope `cover_letter` coché | Uniquement dans l'appel du modèle de génération réel ; les faits professionnels viennent des sources métier |
| ATS, Job Match, Interview Voice | **Non** | Exclusion volontaire : résultats fondés sur preuve ou consentement LiveKit indépendant |
| Autres spécialistes | Pas encore connectés | N'apparaissent pas dans les choix de partage pour éviter une promesse trompeuse |

Le plan de routage du Supervisor peut tenir compte des préférences, mais son analyse ATS/Job Match ne reçoit pas le contexte mémorisé en tant que preuves. Les agents Resume et Cover Letter retrouvent uniquement les préférences expressément partagées avec eux, jamais le contenu arbitraire d'une autre mission.

## API et interface

- `GET /api/career/v1/agent/memory` : lister ses préférences.
- `POST /api/career/v1/agent/memory` : sauvegarder une nouvelle préférence.
- `PATCH /api/career/v1/agent/memory/:id` : corriger la valeur et/ou les agents autorisés.
- `DELETE /api/career/v1/agent/memory/:id` : supprimer définitivement une préférence.

Chaque écriture nécessite une session, le contrôle d'origine (`assertTrustedWriteOrigin`) et une requête JSON limitée, avec `apiVersion: "v1"`. Les modifications/suppressions utilisent `expectedRevision` (CAS) ; conflit HTTP 409 en cas de révision obsolète. Les doublons `(userId,key)` sont refusés.

Bouton **Mémoire** dans `/dashboard/assistant` : consultation, ajout, correction, choix par cases des trois agents, suppression. Pas de sauvegarde à chaque message, pas de stockage navigateur (`localStorage`). Les erreurs restent bornées aux codes publics, sans valeurs de profils/documents.

## PostgreSQL / Prisma

- Nouveau modèle : `CareerAgentMemory`, relation cascade avec `User`.
- Migration : `prisma/migrations/20261031230000_career_agent_memory/migration.sql`.
- Unicité `(userId, key)` ; index `(userId, updatedAt)` ; `revision` optimiste ; `allowedAgents` non vide, avec contrôle SQL des scopes autorisés.
- La mémoire ne contient ni vectorisation ni copie de conversation. **La recherche vectorielle n'est pas implémentée à cette étape** ; le domaine limité des préférences rend la récupération structurée exacte plus fiable et moins coûteuse.
- Aucune modification de variable d'environnement, de credential, de worker LiveKit ni d'automatisation de candidature.

### Application en staging

Fusionner d'abord le ZIP cumulatif sur la base `cvcomet(3).zip` ou sur votre projet à jour en préservant les chemins. Ensuite, sur l'environnement **de staging** et avec une sauvegarde appropriée :

```bash
npm ci
npx prisma migrate deploy
npx prisma generate
npm run test:agentic:stage17
npm run test:agentic:stage17:integration
npm run typecheck
npm run build
```

Ne déployer l'application modifiée qu'**après** la migration et la génération du client Prisma. En absence de nouvelle table et/ou de client régénéré, la lecture de mémoire ne fonctionne pas et peut bloquer la requête ; le déploiement doit respecter cet ordre.

## Politique de rétention, suppression et risques résiduels

- Les préférences explicitement sauvegardées restent actives jusqu'à modification ou suppression par l'utilisateur. La suppression retire immédiatement l'entrée et la suivante lecture renvoie la version à jour ; la durée de rétention légale et la purge des sauvegardes DB restent à définir dans la politique produit.
- Les conversations historiques, CV, entretiens et checkpoints des étapes précédentes ne sont **pas** supprimés par une opération sur les préférences : ils ont des cycles de vie distincts.
- Les données en mémoire restent non fiables vis-à-vis des instructions système et ne doivent pas devenir des qualifications. Les garde-fous ne garantissent pas une absence absolue d'hallucination du modèle.
- Le partage inter-agents est en liste blanche et ne permet aucune lecture transversale entre comptes. Les contrôles d'autorisation sont également appliqués côté DB.
- Un déploiement simultané de l'app et de la migration sans ordre contrôlé n'est pas couvert.

## Reste à valider sur environnement réel

- Exécution de `StateGraph` avec `@langchain/langgraph` installé, puis sortie/suppression de préférences dans une mission authentifiée.
- Génération Prisma, migration Neon de staging, retour HTTP 401/403/409, verrou de révision concurrent et cascade lors de suppression de compte.
- Typecheck, build Next.js, tests UX desktop/mobile, latence d'une lecture de mémoire depuis Neon.
- Tests de qualité des réponses : préférence de langue modifiée, rôle cible vs compétence acquise, réponses ATS/Job Match insensibles aux mémoires, confirmation explicite pour toutes les écritures métier.
