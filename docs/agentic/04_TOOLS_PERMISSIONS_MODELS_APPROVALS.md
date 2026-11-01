# Étape 04/20 — Outils, permissions, modèles IA et approbations

Base unique : `cvcomet(3).zip` + correctifs cumulés des étapes 01, 02 et 03.
Cette étape ne migre **aucun** endpoint métier. Aucun schéma Prisma, document, interface ou fichier `.env` n'est modifié.

## 1. Organisation et séparation des responsabilités

- `src/lib/agentic/core/tools/agent-tool-registry.ts` : outils métier typés, validation des entrées, autorisation à chaque appel, classification des capacités.
- `src/lib/agentic/core/policies/tool-access.ts` : allowlist explicite d'agents et permissions minimales.
- `src/lib/agentic/core/policies/approval.ts` : requête d'approbation déterministe, empreinte des arguments, validation du consentement et reçu non sérialisable.
- `src/lib/agentic/core/tools/reviewed-execution.ts` : orchestration préparer → interrompre → valider → exécuter.
- `src/lib/agentic/core/nodes/reviewed-tool-node.ts` : nœud LangGraph utilisant `interrupt()` ; **ne pas** l'envelopper dans `scope.step()/tracedNode()`.
- `src/lib/agentic/core/models/model-gateway.ts` : port de modèle, contrôle du budget des requêtes et tests avec dépendances injectées.
- `src/lib/agentic/core/models/cvcomet-ai-sdk.ts` : adaptateur réel utilisant `getAIModel()` et `reserveAIQuota()` existants.
- `src/lib/agentic/agents/demo/agent/review-graph.ts` et `demo/tools/` : exemple **synthétique**, uniquement pour le test LangGraph HITL.

La structure `agents/{agent}/agent`, `nodes`, `tools`, `prompts` est maintenue : la politique partagée vit dans `core/`, jamais dans les prompts.

## 2. Capacités et décisions

| Capacité | Règle |
| --- | --- |
| `read` | Autorisation DB obligatoire pour chaque lecture privée |
| `analyze` | Identité et agent autorisés, quotas facturés pour chaque appel de modèle |
| `prepare` | Brouillon non appliqué, jamais considéré comme modification enregistrée |
| `write` | Autorisation avant et après le `interrupt()`, approbation exacte, revision et idempotence DB obligatoires |
| `external` | Refus systématique en étape 04, y compris email ou soumission |

Les `permittedAgents` sont déclarés par l'application ; le modèle ne fournit ni actorId, ni session, ni privilèges. La fonction `authorize()` de chaque outil futur doit **relire** les permissions du propriétaire au moment de l'exécution et vérifier les éventuels blocs et partages.

### Écriture sensible : protocole

1. Un outil `write` transforme la proposition en arguments validés et calcule la ressource et sa révision.
2. `prepareApproval()` vérifie l'accès en lecture/écriture et crée un défi contenant uniquement `{ kind, approvalId, toolName, resourceId, revision }`.
3. Le nœud LangGraph appelle `interrupt(challenge)` ; le checkpoint conserve le contexte de la mission.
4. Le frontend affichera à l'avenir les différences depuis une API sécurisée qui **relit** la proposition ; l'interruption ne contient pas les données du candidat.
5. Le backend reprend le thread autorisé avec `new Command({ resume: { approvalId, decision: "approve" | "reject" } })`. Le `thread_id` n'est jamais un identifiant accepté librement depuis le navigateur.
6. Le nœud redémarre, produit la **même empreinte** d'approbation, vérifie le reçu, puis **revalide** l'autorisation et la version actuelle.
7. `executeIdempotently()` doit faire un contrôle transactionnel de la révision et d'une clé d'idempotence unique au niveau PostgreSQL ; un simple `Map` en mémoire est **interdit** dans un agent métier.

> ATTENTION : LangGraph reprend un nœud interrompu depuis son début. Ne pas exécuter d'effet de bord avant `interrupt()`. La revalidation et les clés d'idempotence sont obligatoires pour éviter les doubles écritures si un worker redémarre après un commit.

### Limite de l'étape

Le registre envoie une clé d'idempotence, **mais n'implémente pas** la transaction métier : elle viendra avec l'agent Resume/Cover Letter/Application. Le test démo utilise seulement un registre synthétique en mémoire et ne doit pas être connecté à la production. Aucun appel d'écriture réelle n'est activé.

## 3. Port de modèle unique

`cvcometAgentModel.text(...)` et `.object(...)` :

- Appels réservés aux utilisateurs authentifiés ; prompts système et utilisateur bornés, maximum de tokens limité.
- Quota via `reserveAIQuota(actorId, feature)` **avant** l'appel au modèle ; utilisation des features existantes (`RESUME_EDIT`, `JOB_ANALYSIS`, etc.).
- Modèle par `getAIModel({ structuredOutputs })` — mêmes fournisseurs OpenAI, Google, Claude, Groq et Hugging Face configurés dans CVComet.
- Appels `generateText` / `generateObject` avec `abortSignal`, `maxRetries` et parsing structuré.
- Erreurs fournisseur converties en codes sûrs ; aucune clé, argument brut ou sortie IA envoyée dans les événements.

Le calcul de crédits et les limites du service `ai/quota-service.ts` restent la source de vérité. Chaque tentative payante peut consommer des crédits même si elle échoue, conformément à la politique actuelle. Les appels réels ne sont pas déclenchés lors des tests du socle.

## 4. Exemple futur d'un outil métier

```ts
registry.register({
  name: "apply_resume_patch",
  capability: "write",
  permittedAgents: ["resume"],
  parse: (raw) => resumePatchSchema.parse(raw),
  authorize: (patch, ctx) => verifyOwnerAndRevisionInDatabase(patch, ctx.identity),
  target: (patch) => ({ resourceId: patch.cvId, revision: String(patch.revision) }),
  executeIdempotently: (patch, ctx, key) => applyResumePatchAtomically(patch, ctx, key),
});
```

**Exemple d'intégration uniquement.** Les fonctions `verifyOwnerAndRevisionInDatabase` et `applyResumePatchAtomically` ne sont pas créées en étape 04. Il ne faut pas les appeler telles quelles.

## 5. Validation de l'étape

```powershell
node --experimental-strip-types --test scripts/agentic-stage04.test.mjs
node --experimental-strip-types --test scripts/agentic-stage04-integration.test.mjs
npm run typecheck
npm run build
```

- Les tests purs fonctionnent sans compte fournisseur ni base de données.
- Le test d'intégration **obligatoire** exige `@langchain/langgraph` installé et vérifie `interrupt`, `Command(resume)`, refus et reprise sur un checkpointer mémoire.
- Le test PostgreSQL de l'étape 03 reste requis sur **une base de test dédiée** avant toute exploitation des missions durables.
- Le projet local utilisé pour composer l'archive ne possède pas `node_modules`. Les tests d'intégration LangGraph, `typecheck` et `build` ne sont donc pas certifiés localement.

### Critères de passage à l'étape 05

- Tests d'intégration LangGraph, typecheck, build et test PostgreSQL dédiés réussis.
- Aucun accès non autorisé possible dans les tests de sécurité.
- Aucun agent métier ni frontend modifié lors des étapes 01 à 04.
- Revue d'une implémentation DB transactionnelle avant d'autoriser une écriture réelle.
