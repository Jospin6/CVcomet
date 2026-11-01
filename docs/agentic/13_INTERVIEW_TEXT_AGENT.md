# Étape 13/20 — Interview Text Agent (LangGraph)

## Périmètre livré

Migration de l'entretien **textuel** existant (`/dashboard/interviews`, `POST /api/interviews`, `POST /api/interviews/[id]/message`, et la préparation de sessions) vers deux graphes LangGraph, sans modifier le schéma Prisma, les routes publiques, le simulateur de voix LiveKit ni l'interface déjà fonctionnelle.

L'agent se trouve dans `src/lib/agentic/agents/interview-text/` avec quatre répertoires indépendants :

```text
agent/   state.ts, graph.ts, interview-text.agent.ts
nodes/   context.node.ts, generate.node.ts, verify.node.ts, assemble.node.ts
tools/   contracts.tool.ts, validation.tool.ts
prompts/ preparation.prompt.ts, evaluation.prompt.ts
```

Deux graphes **réellement appelés** par les services :

- **Préparation** : `context → generate → verify → assemble`. La préparation personnalisée charge un CV uniquement via `conversation.userId`, vérifie la candidature par `application.userId`, utilise le profil du compte authentifié, puis réserve le quota `INTERVIEW_PREPARATION` **avant** l'entrée dans le graphe. Le nœud de génération appelle l'IA existante via l'adaptateur serveur et valide les questions. Si l'IA n'est pas disponible, il conserve des questions pédagogiques statiques clairement identifiées. Une limite de quota `429` lors de la préparation conserve le contrat de refus existant.
- **Évaluation** : `context → generate → verify → assemble`. La réponse fournie par l'utilisateur reste une donnée non fiable pour l'IA. Quatre critères `0..4` (pertinence, précision, structure, clarté) sont évalués par le modèle sous schéma strict, mais **la note finale est recalculée par le code** et non choisie par le modèle. La citation n'est conservée que si elle apparaît dans la réponse de l'utilisateur. En cas d'échec de quota, fournisseur ou format, `status:unavailable`, `score:null` et progression conservée sans note inventée.

Le mode « Basic » de `POST /api/interviews` passe également par le graphe de préparation avec le catalogue statique, sans consommation IA. Le mode personnalisé conserve le contrat `PREPARATION` → `ACTIVE` → `READY_TO_FINISH` → `COMPLETED`.

## Garanties et limitations

- **Aucun outil d'écriture** n'est exposé par les graphes. La création des sessions, la sauvegarde des messages, le calcul du bilan et la mise à jour des statuts restent dans `src/lib/career/interview.ts` sous contrôle de l'authentification et de Prisma.
- La protection transactionnelle `updateMany` avec compare-and-swap sur `currentQuestion`, le blocage des requêtes concurrentes périmées et le principe d'une session préparée réutilisée pour la simulation sont conservés.
- Aucune donnée du profil, du CV, des réponses ou de l'offre n'est checkpointée dans LangGraph. Les événements techniques de `runAgentGraph` n'enregistrent que des noms d'étapes et des codes d'erreur.
- Le profil envoyé au modèle est limité aux éléments **professionnels** utiles : pas d'e-mail, adresse ou téléphone extraits de `careerProfileContext` dans ce payload. Le CV utilisé est celui déjà autorisé par l'application.
- Les réponses suggérées sont des **consignes pédagogiques** : les assertions en première personne et les chiffres d'accomplissement suspects sont remplacés par des conseils génériques. Aucun accomplissement ou résultat de recrutement n'est inventé ou garanti.
- La machine à états et `summarizeInterview()` demeurent déterministes. Un bilan totalise uniquement les réponses réellement évaluées et distingue les questions sans note. Aucun score n'est fondé sur la longueur d'une réponse.
- Les temps limites sont bornés (préparation 48 s dont appel modèle limité à 40 s ; évaluation 26 s dont appel modèle limité à 20 s ; récursion 12). Les annulations émises au graphe sont transmises au fournisseur via `AbortSignal`.
- **Étape 13 : entretien textuel uniquement.** Le graphe de l'entretien vocal/LiveKit sera traité par l'étape dédiée ; aucune capture, conservation ou transmission audio supplémentaire n'est ajoutée ici.

## Vérifier

```bash
npm run test:agentic:stage13
npm run test:agentic:stage13:integration
npm run test:phase10
npm run test:agentic:stage10
npm run test:agentic:stage11
npm run test:agentic:stage12
npm run typecheck
npm run build
```

Les tests unitaires et de simulation du graphe ne remplacent **pas** l'exécution du vrai LangGraph avec `@langchain/langgraph` installé, les tests API avec DB et fournisseur IA, ni le build complet. Le bilan local exact est dans `13_VALIDATION.md`.
