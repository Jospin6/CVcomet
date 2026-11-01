# CVComet LangGraph — Étape 18/20 : interface agentique et streaming

## Périmètre livré

L'interface existante `/dashboard/assistant` expose la progression d'une mission pendant que le **Career Assistant Supervisor LangGraph** exécute ses nœuds et lectures propriétaires. Le design général, le compositeur, les conversations, les brouillons approuvables et les protections de propriété sont conservés. La réponse finale reste affichée uniquement après vérification par la politique de qualité existante.

**Ce n'est pas une diffusion de tokens du LLM.** Il s'agit d'un **streaming SSE d'événements de progression vérifiés**. Diffuser les tokens avant la validation finale pourrait révéler une réponse non vérifiée; cela nécessiterait une politique de modération et de reprise spécifique.

## Événements

- `mission.started`, `mission.completed`, `mission.failed` : cycle de vie de l'exécution propriétaire.
- `step.started`, `step.completed`, `step.failed` : nœuds du graphe réel (`tracedNode` + `runAgentGraph`).
- `tool.started`, `tool.completed`, `tool.failed` : lectures autorisées, sans aucun argument ni résultat.
- `approval.required` : une approbation **déjà enregistrée** est en attente au moment de la fin de la mission; cet événement ne crée pas d'approbation et ne l'exécute pas.

L'événement persistant contient seulement un identifiant numérique, `userId`, `missionId`, `runId`, le numéro de tentative, `kind`, un nom d'étape limité, un code d'erreur borné et un horodatage. Aucun prompt, extrait de CV, réponse du modèle, argument d'outil, document, transcription ou email n'est journalisé dans cette table.

## Architecture

- `src/lib/agentic/agents/mission-stream/agent/mission-stream.agent.ts` : adaptateur entre le vrai superviseur et l'émetteur de progression.
- `nodes/persist.node.ts` : écriture ordonnée et bornée à 48 événements par tentative; échec de télémétrie non bloquant pour une mission déjà autorisée.
- `nodes/replay.node.ts` : filtre **userId + missionId + requestKey + runId + attempt**, progression à partir d'un curseur numérique.
- `tools/events.tool.ts` : liste blanche des événements, nom d'étape et code d'erreur validés; aucune donnée privée.
- `tools/sse.tool.ts` : trames SSE et validation des identifiants `Last-Event-ID`.
- `GET /api/career/v1/missions/:id/runs/events?requestKey=<uuid>` : **authentification et propriété** vérifiées avant ouverture du SSE; nouveaux contrôles de périmètre dans chaque lecture; pas de CORS public, cache privé désactivé.
- `src/components/career/CareerMissionProgress.tsx` : indicateur compact et liste d'étapes accessibles, en français/anglais, dans le chat existant.
- `src/app/dashboard/assistant/page.tsx` : abonnement EventSource, déduplication, reconnexion limitée, navigation par URL `missionId`, suivi d'une mission en cours et récupération de l'historique par les API de mission.

Le POST de mission `/api/career/v1/missions/:id/runs` reste le **déclencheur authentifié et idempotent**; le GET SSE ne crée aucune mission ni exécution. L'application n'envoie jamais d'action sensible depuis un événement d'avancement. Les boutons de validation existants restent indépendants et explicites.

## Continuité de mission et rechargement

À la sélection/création d'une mission, son ID apparaît dans `?missionId=...`, sans conserver le texte dans `localStorage`/`sessionStorage`. À la réouverture de l'URL, l'application charge d'abord la mission par l'API sécurisée, puis retrouve son dernier `requestKey`. Les événements de la tentative courante sont rejoués en lecture seule. `Last-Event-ID` permet de reprendre après une coupure SSE; les événements sont stockés en PostgreSQL, pas dans la mémoire du navigateur.

Le système protège toujours une seule exécution active par mission avec lease, requestKey et révisions; la reprise après une coupure n'envoie **pas** une seconde exécution. Si le serveur ou un déploiement interrompt la requête POST, l'exécution peut être classée comme interrompue après expiration du lease. La récupération consiste alors à consulter la mission puis à relancer explicitement si nécessaire; il n'y a **pas** de garantie d'exécution de tâche en arrière-plan après fermeture du navigateur.

Un SSE peut durer jusqu'à 52 secondes avant reconnexion, avec une lecture PostgreSQL toutes les 1,2 secondes. Les résultats du modèle ne sont jamais accessibles par ce flux. Le maintien de nombreuses connexions SSE simultanées est à contrôler avec un limiteur distribué ou une architecture de notifications avant le passage à l'échelle.

## Migration PostgreSQL

La migration `20261101001500_career_mission_progress_stream` crée `CareerMissionProgressEvent` et ses index, avec deux FK en cascade (mission et run). La migration de l'étape 17 doit être appliquée d'abord. Sauvegarder la base de **staging**, exécuter `npm ci`, `npx prisma migrate deploy`, `npx prisma generate` puis le build, avant de déployer la nouvelle application.

## Sécurité et limites

- La route SSE nécessite une session utilisateur et ne révèle pas si une mission appartient à un autre compte (404).
- Les lectures filtrent de nouveau par propriétaire, identifiant de mission et tentative. Les identifiants de progression sont techniques et bornés. En cas d'incident de base, la télémétrie n'interrompt pas la mission; l'interface indique si le suivi est indisponible.
- Les émissions de tool n'incluent ni paramètres, ni résultats bruts, ni texte de messages; aucune action d'écriture n'est introduite dans le superviseur.
- Pas d'ajout de worker, de secret ou de variable d'environnement.
- Les événements de progression demeurent jusqu'à la suppression de la mission (cascade). Une politique de rétention/purge globale reste à définir avant une volumétrie importante.

## Hors périmètre

Le flux de tokens du texte, le transport SSE de tous les autres agents métiers, la reprise automatique de tâches après fermeture de l'onglet, les notifications push, la supervision multi-région, la limitation distribuée de connexions et l'intégration E2E sur Neon/Vercel ne sont pas annoncés comme terminés.
