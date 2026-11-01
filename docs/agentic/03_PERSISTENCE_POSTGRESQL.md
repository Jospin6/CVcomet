# CVComet 3.0 — Étape 03/20 : checkpoints et reprise durable

## Périmètre

Cette étape ajoute **l'infrastructure** de persistance LangGraph en PostgreSQL. Aucun agent métier ni endpoint Next.js n'a été branché. La séparation `agent/`, `nodes/`, `tools/`, `prompts/` de l'étape 02 reste inchangée. Le seul graphe de validation est un **demo** sans CV ni données utilisateur.

### Cycle d'une mission

1. Le serveur authentifié construit `{ actorId, agentId, missionId, runId }` ; `missionId` est un UUID stable pour la mission, `runId` est unique à chaque tentative.
2. `makeMissionThread()` produit un `thread_id` opaque (`cv3-v1-` + SHA-256) à partir de l'acteur, de l'agent et de la mission. Il ne contient aucune donnée utilisateur lisible.
3. `withPgThreadLock()` prend un verrou PostgreSQL par mission avec `pg_try_advisory_lock`. Une autre tentative sur le même thread reçoit `AGENT_THREAD_BUSY` au lieu de s'exécuter simultanément.
4. Pour un démarrage, l'existence d'un checkpoint interdit un deuxième `start` (`AGENT_THREAD_ALREADY_EXISTS`).
5. Les graphes sont compilés avec `PostgresSaver`. `LangGraph` enregistre les états et écritures intermédiaires pendant leur exécution.
6. Une interruption `interrupt()` rend l'état **paused**, sans être assimilée à un succès final. La reprise utilise un `Command({ resume: ... })` et nécessite un interrupt réellement en attente.
7. Après une erreur récupérable, un `retry` utilise le dernier checkpoint seulement si des étapes restent à exécuter et **aucune approbation n'est en attente**. Les agents devront passer `null` comme input LangGraph de retry lorsque c'est approprié.
8. La suppression d'une mission peut appeler `deleteDurableMission()`, qui supprime les checkpoints rattachés au thread de l'acteur et de l'agent.

## Installation

Dans la racine du projet, après fusion des fichiers cumulés :

```bash
npm install @langchain/langgraph-checkpoint-postgres@^1.1.2 pg@^8.14.1
npm install -D @types/pg@^8.11.11
```

`@langchain/langgraph` et `@langchain/core` étaient déjà déclarés dans la base `cvcomet(3).zip`.

## Base PostgreSQL / Neon

Le checkpointer `PostgresSaver` fonctionne avec le driver PostgreSQL `pg` sur **Node.js**, pas avec le runtime Edge ni le driver Neon HTTP. Le pool est borné à **4 connexions par processus** par défaut (réglable entre 3 et 10), et deux connexions sont réservées aux opérations de checkpoint (`maxConcurrentRuns = poolMax - 2`). Au-delà, le serveur renvoie `AGENT_CHECKPOINT_BUSY` plutôt que de bloquer le pool. En déploiement multi-instance, le maximum réel est `poolMax × nombre d'instances` : dimensionner le pool Neon et limiter les workers en conséquence.

Le code utilise, par ordre de priorité :

1. `AGENTIC_CHECKPOINT_DATABASE_URL` — URL **directe** dédiée, recommandée pour l'isolation du checkpoint (optionnelle).
2. `DATABASE_URL_UNPOOLED` — variable directe déjà référencée par le schéma Prisma de CVComet.

**Il ne retombe volontairement pas sur `DATABASE_URL`**, qui peut correspondre à un pooler incompatible avec certains comportements du checkpoint. Ne jamais committer les URLs réelles ni les imprimer dans les logs. `AGENTIC_CHECKPOINT_POOL_MAX` est facultative (défaut : 4).

### Création des tables

Une seule fois avant l'activation des graphes :

```bash
npm run agentic:checkpoint:setup
```

Cette commande exécute `PostgresSaver.setup()`, qui crée/actualise ses propres tables (`checkpoints`, `checkpoint_blobs`, `checkpoint_writes`, etc.) dans le schéma **public**. Elle ne crée aucune migration Prisma et ne change aucun modèle métier. Le compte de setup doit disposer des permissions DDL requises. Ne pas lancer `setup()` dans les requêtes utilisateurs, ni simultanément dans plusieurs processus de déploiement.

## Vérification des reprises avec une base de test ISOLÉE

Utiliser une base PostgreSQL **sans aucune donnée de production** et distincte des bases des utilisateurs. Définir dans le terminal du test, jamais dans Git :

- `AGENTIC_CHECKPOINT_DATABASE_URL` pointant vers cette base de test ;
- `AGENTIC_CHECKPOINT_TEST_DB=1` pour confirmer explicitement la destination isolée.

Puis exécuter :

```bash
npm run test:agentic:stage03
npm run test:agentic:stage03:db
npm run typecheck
npm run build
```

Le test DB bloque si ces deux conditions ne sont pas remplies. Il crée une mission de démonstration, l'interrompt, ferme et recrée le pool, la reprend, vérifie le résultat et efface son checkpoint. Cela prouve la persistance au-delà du cycle de vie d'un worker, **pas** la qualité IA des futurs agents.

## Sécurité et limites

- **Aucun endpoint public de reprise** n'est livré à cette étape. Les futurs endpoints devront revalider la session, l'appartenance de la mission, l'approbation et les révisions avant d'utiliser le runtime.
- Les checkpoints futurs peuvent contenir des données personnelles. Les graphes métier devront ne conserver que le contexte minimal, de préférence des IDs plutôt que des CV entiers, et définir une politique de rétention/suppression à l'étape 04 et lors du branchement des agents.
- Les verrous réduisent les duplications concurrentes mais ne garantissent **pas** l'exécution exactement une fois en présence d'effets externes ou de panne réseau. Les futurs outils d'écriture nécessitent idempotency keys, transactions et une approbation explicite.
- Une interruption annulée ou un timeout peut laisser du travail asynchrone en cours si l'outil sous-jacent ignore `AbortSignal`. Aucun outil d'écriture n'est activé ici.
- Les erreurs du serveur et du driver sont converties en codes stables : aucune URL ni donnée du document n'est intégrée dans les erreurs métier.
- Les migrations/états du checkpointer sont dépendants de la version installée de LangGraph. Garder les versions npm cohérentes entre workers et application ; tester les upgrades en staging.
- La mémoire longue durée inter-missions n'est **pas** implémentée à cette étape (prévue à l'étape 17).
- L'orchestration persistante des workers et la reprise automatique des missions à l'arrêt du processus ne sont **pas** encore livrées. Cette étape fournit les primitives de reprise explicite, pas un ordonnanceur ni une queue.

## Sources techniques

- https://github.com/langchain-ai/langgraphjs/blob/main/libs/checkpoint-postgres/README.md
- https://docs.langchain.com/oss/javascript/langgraph/persistence
- https://docs.langchain.com/oss/javascript/langgraph/interrupts
