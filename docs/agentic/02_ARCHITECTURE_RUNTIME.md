# CVComet 3.0 — Étape 02/20 : noyau LangGraph et conventions

## Statut et périmètre

- Base : **`cvcomet(3).zip`** SHA-256 `6a00de192a24a46d826fd113bf4d3b763237fcf93ea7e4610134a6c66995ca1c`.
- Rectificatif audit 01 : contrairement au premier rapport, **aucun ancien graphe LangGraph** dans ce ZIP ; seuls les packages sont déclarés. Inventaire et test 01 corrigés.
- Étape 02 : noyau typé, registre d'outils **lecture seule**, annulation et délai, erreurs structurées, identité d'exécution, événements sobres, graphe `demo` compilable avec `StateGraph`.
- **Aucun endpoint, agent métier, schéma Prisma, UI, configuration d'environnement, provider, worker ou permission existants modifiés**.
- Aucun checkpoint persistant pour le moment (étape 03). Pas de reprise, mémoire durable ou confirmation humaine revendiquée à cette étape.

## Séparation obligatoire par agent

Chaque agent sous `src/lib/agentic/agents/<id>/` possède :

- `agent/` : graphe, composition, état et point d'entrée du sous-agent.
- `nodes/` : nœuds unitaires, contrôlés et testables.
- `tools/` : schémas, contrôles d'accès et adaptateurs aux outils métiers existants.
- `prompts/` : instructions du modèle, versions et contrats de sortie.

Les 11 agents métier ont leurs quatre dossiers réservés, **sans faux agent actif**. L'agent `demo` est le seul qui exécute effectivement un graphe pour l'étape 02.

Le noyau `core/` contient uniquement la logique transversale : `contracts.ts`, `errors.ts`, `policies/identity.ts`, `execution/{budget,runner}.ts`, `events.ts`, `tools/read-tool-registry.ts`, `nodes/traced-node.ts` et `models/model-port.ts`.

## Protocole d'exécution

1. Le backend fournit une identité fiable `{ runId, agentId, access }`.
2. Le runtime refuse toute identité invalide ; `public_demo` est autorisé uniquement pour l'agent `demo`.
3. Le budget fixe un délai et un signal d'annulation ; `recursionLimit` protège contre les boucles excessives.
4. Le graphe est construit à partir du scope, puis invoqué avec signal et limite.
5. Les nœuds utilisent `tracedNode` pour émettre leurs transitions et respecter le budget.
6. Les outils de lecture valident puis autorisent leurs arguments ; les futurs outils privés doivent revérifier la propriété dans la base de données.
7. Le runtime ne communique que des événements allowlistés : identité de mission, nom d'étape, statut, code d'erreur, horodatage. **Jamais de texte de CV, de prompt, ni de paramètres d'outil**.
8. En cas d'échec, un code sûr est retourné. La cancellation n'annule pas automatiquement des effets externes déjà réalisés ; les écritures resteront interdites tant que l'étape 04 ne les encadre pas.

## Vérifications réalisées localement

- Tests contractuels du noyau : **11 réussis** ; audit corrigé : **5/5 réussis**. Le test réel est désormais **obligatoire et séparé**, sans aucun `skip` automatique.
- Tests de référence phases 00–13 : **190 réussis, zéro échec**.
- Phase 14 : **4/4 réussis**.
- Contrôle de syntaxe : **446 TS/TSX, aucune erreur de syntaxe**.
- Vérification TypeScript stricte du noyau `core/` : **réussie** sans dépendance LangGraph.
- Échec du test réel de `StateGraph` : **non exécuté**, car cet environnement ne possède ni `node_modules` ni accès au registre npm. Pas de prétention à une validation intégrée complète.

## Vérifications et limites

- Tests du noyau et contrôles des dossiers exécutables avec `node --experimental-strip-types --test scripts/agentic-stage02.test.mjs`.
- Test réel de compilation + exécution de `StateGraph` uniquement si `@langchain/langgraph` est installé. **Sans `node_modules`, test d'intégration marqué SKIP ; ce n'est pas un succès de runtime**.
- Tests historiques et syntaxe exécutables sans secrets ni base de données.
- Typecheck et build nécessitent les dépendances npm installées ; exécuter sur la machine de développement :

```bash
node --experimental-strip-types --test scripts/agentic-stage01.test.cjs scripts/agentic-stage02.test.mjs
node --experimental-strip-types --test scripts/agentic-stage02-integration.test.mjs
npm run check:syntax
npm run typecheck
npm run build
```

## Critères d'acceptation

- Quatre dossiers distincts existants pour chaque agent prévu.
- Exécution de démonstration vérifiée contre le véritable LangGraph sur un environnement avec dépendances installées. **Condition bloquante pour la validation définitive.**
- Annulement, délai, filtrage des événements, autorisations des outils et interdiction de `public_demo` pour les agents métiers testés.
- Aucun changement de comportement des services existants.

Étape suivante, uniquement après validation : 03 — checkpointer PostgreSQL, thread IDs, récupération et reprise durables.

## Complément de sécurisation de l'étape 02

- Les identités invalides, absentes ou contenant des retours à la ligne sont rejetées par un code stable.
- Les noms de nœuds dans les événements sont limités à des identifiants techniques sûrs, jamais à des contenus documentaires.
- Les erreurs de base de données ou de fournisseur levées par les outils sont converties en codes sûrs, sans divulgation du message d'origine.
- Le test `agentic-stage02.test.mjs` ne contient plus d'intégration silencieusement ignorée.
- Le test `agentic-stage02-integration.test.mjs` constitue une véritable porte de validation : sans dépendances npm, il échoue explicitement.
