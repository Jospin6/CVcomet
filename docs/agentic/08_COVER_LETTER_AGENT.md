# Étape 08/20 — Cover Letter Agent (LangGraph)

## Base et limites

Base cumulative : `cvcomet(3).zip` + les patches validés 01–07. Le patch 08 est additif et n'apporte ni migration Prisma, ni nouvelle variable d'environnement, ni nouveau design de l'éditeur. Aucun ancien ZIP n'a été utilisé comme projet complet.

L'étape 08 migre trois flux IA **de lettres de motivation** :

1. `POST /api/cover-letters/[id]/assistant` (éditeur Chat + Selected text).
2. `proposeApplicationDraft(..., "letter", ...)` (depuis une candidature).
3. `jobCoverLetter(..., {action:"GENERATE"})` (depuis une offre ou un CV relié à l'offre).

Les outils de création manuelle de lettres, templates, exports, la génération d'emails de candidature et les lettres de démission ne sont pas refondus à cette étape. Les routes existantes conservent leur format de requête/réponse ; la génération continue à retourner un brouillon, et `SAVE` continue à enregistrer par le chemin existant.

## Structure de l'agent

```text
src/lib/agentic/agents/cover-letter/
├── agent/
│   ├── cover-letter.agent.ts         # API d'édition
│   ├── graph.ts                      # Graphe d'édition
│   ├── state.ts                      # État éphémère d'édition
│   ├── creation.agent.ts             # API de génération
│   ├── creation-graph.ts             # Graphe de génération
│   ├── creation-state.ts             # État éphémère de génération
│   └── errors.ts                     # Erreurs sûres et typées
├── nodes/
│   ├── plan.node.ts, generate.node.ts, verify.node.ts, review.node.ts
│   └── plan-creation.node.ts, generate-creation.node.ts,
│       verify-creation.node.ts, review-creation.node.ts
├── tools/
│   ├── plan-edit.tool.ts, generate-edit.tool.ts, verify-edit.tool.ts
│   └── plan-creation.tool.ts, generate-creation.tool.ts,
│       verify-creation.tool.ts
└── prompts/
    ├── edit.prompt.ts
    └── creation.prompt.ts
```

Les deux graphes `StateGraph` sont exécutés via `runAgentGraph()` du noyau. L'état du graphe peut contenir le contenu de la lettre : **aucun checkpointer ne doit être associé à ces graphes**. La persistance des propositions utilise toujours `CoverLetterAIProposal` dans Prisma, avec date d'expiration, révision et décision humaine explicite.

## Graphe édition

`plan -> generate -> verify -> review` avec branche `plan -> review` pour clarification (ex. adaptation demandée sans offre reliée).

- Les métadonnées du candidat, de l'employeur, du recruteur et du poste sont verrouillées côté serveur avec `lockLetterIdentity`.
- L'onglet Selected text ne peut produire qu'un changement à `introduction`, `body` ou `conclusion`, jamais à un autre paragraphe ou au design.
- Aucune modification de design si l'instruction utilisateur ne le demande pas explicitement ; les valeurs `paper`, `targetMarket`, `documentLanguage` et `templateId` sont toujours conservées depuis la version originale.
- Les résultats chiffrés non étayés ou technologies seulement citées dans l'offre sont rejetés ; l'agent demande une clarification.
- Le serveur reconstruit la version autorisée et calcule un diff indépendant avant de créer une proposition.
- Le client doit accepter via la route `decision/route.ts` déjà existante. L'approbation vérifie la propriété, les révisions, la date d'expiration et l'état de la proposition.
- Le modèle ne reçoit pas les coordonnées privées du candidat dans le prompt d'édition ; elles sont verrouillées et préservées côté serveur.

## Graphe création

`plan -> generate -> verify -> review`, avec sortie de clarification si le contexte est insuffisant. Les prompts conservent la logique métier de génération et les conventions de pays déjà définies par CVComet. L'offre reste une cible, jamais une preuve des compétences du candidat.

Les métadonnées générées (nom du recruteur, nom/adresse d'entreprise, identité du candidat) sont ignorées au profit de données lues du profil et de l'offre du propriétaire. La vérification écarte les nouveaux nombres et termes techniques sans preuves. Une erreur `UNSUPPORTED_FACTS` reste une erreur de validation (HTTP 422), pas une panne du fournisseur IA.

Le bouton d'enregistrement existant est conservé. L'agent n'exécute aucune écriture Prisma.

## Fournisseurs, quotas et sécurité

Chaque génération IA passe par le même `cvcometAgentModel.object`, avec la feature de quota `COVER_LETTER`. La sélection OpenAI/Gemini/Claude/Groq/Hugging Face et les crédits restent ceux de CVComet. Pas de nouvelle clé, connexion ou configuration modèle.

Les routes de génération POST reçoivent désormais une vérification de l'origine de confiance (CSRF). Les routes conservent l'authentification, l'autorisation sur les documents du candidat, les validations Zod, le contrôle des révisions, l'origine de confiance dans le chemin éditeur, le traitement des erreurs et l'absence d'enregistrement automatique d'une proposition.

## Tests

- `npm run test:agentic:stage08` : tests unitaires et structurels sans IA et sans base.
- `npm run test:agentic:stage08:integration` : véritable exécution LangGraph avec modèle simulé (packages npm requis), sans réseau, sans base et sans crédit IA.
- `npm run test:cvcomet:baseline` : tests métier historiques.
- `npm run test:phase14` : tests de la phase finale historique.
- `npm run typecheck` puis `npm run build` : contrôles obligatoires après installation.

Aucune fonctionnalité de l'étape 09 (ATS Agent) n'est implémentée dans ce patch.
