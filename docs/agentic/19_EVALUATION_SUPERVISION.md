# CVComet / LangGraph — Étape 19/20 : évaluation et supervision

## Périmètre effectif

L'étape ajoute un **agent d'évaluation opérationnelle en lecture seule** et une **matrice locale de tests multi-agents**. L'agent lit des **comptages agrégés** déjà observés par les étapes précédentes : observations du Career Assistant, états des exécutions de missions, événements SSE techniques de mission et comptabilité `AIUsage`. Il n'effectue aucun appel IA ni modification métier. Le propriétaire des métriques est l'administrateur authentifié, contrôlé dans la route **avant** l'exécution du graphe.

### Architecture

`evaluation/agent/{state,graph,evaluation.agent}.ts` : LangGraph `context → read → measure → gate → verify`, sans checkpoint utilisateur. Le périmètre de sept jours est construit côté serveur, jamais choisi par un prompt ou un outil IA.

`evaluation/nodes/` : orchestration de la vérification du périmètre, du calcul et de la décision.

`evaluation/tools/` : lecture Prisma des seuls GROUP BY / agrégats existants, validation des noms d'événements et des codes d'erreurs, métriques avec dénominateurs définis et seuils de staging. Les estimations de coût restent inconnues (`null`) en cas de tarification incomplète.

`evaluation/prompts/` : politique explicite de traitement des sorties non fiables ; l'agent opérationnel ne passe **aucun prompt au modèle**.

`GET /api/admin/agentic/quality` et `/admin/agentic-quality` : compteurs et blocages visibles aux seuls administrateurs. Aucun `userId`, CV, texte de conversation, transcription, prompt, résultat brut d'outil ni contenu d'entreprise n'est retourné. L'interface reste responsive et accessible, sans action d'écriture.

`prisma/migrations/20261101003500_agentic_quality_indexes` : trois index temporels sur les tables déjà existantes (`CareerMissionRun`, `CareerMissionProgressEvent`, `AIUsage`). Aucune nouvelle copie de donnée personnelle.

## Seuils opérationnels, établis avant recette

- Minimum de **30 observations** pertinentes pour conclure sur un taux. Moins de 30 : `INSUFFICIENT_DATA`, jamais 100 %.
- Terminaison enregistrée du Career Assistant : **≥ 95 %**, calculée comme `COMPLETED / (COMPLETED + FAILED)` pour les observations réellement écrites.
- Latence p95 des **dernières réponses terminées échantillonnées** : **≤ 55 000 ms**, avec au moins 30 mesures. Un échantillon des 1 000 dernières réponses n'est pas un échantillon uniforme.
- Taux de terminaisons de missions : **≥ 95 % des tentatives à état terminal** ; `RUNNING` n'est pas inclus au dénominateur.
- **0 lease expiré encore en état RUNNING**, sur la fenêtre de consultation ; une défaillance de réconciliation est bloquante.
- **100 % des appels IA enregistrés disposent d'une estimation tarifaire** pour satisfaire le contrôle de couverture, sans prétendre que toutes les opérations IA ont été comptabilisées. Coûts = estimations configurées et non facture fournisseur.
- La présence de données privées dans les logs, un accès inter-compte, une action externe non approuvée, une réponse contenant des réalisations inventées ou une preuve d'entretien non vérifiée sont **bloquants**, même si le taux de complétion est élevé. Ils nécessitent des tests adversariaux et une validation humaine spécifiques.

Les statuts `PASS`, `FAIL`, `INSUFFICIENT_DATA`, `NOT_MEASURED` sont distincts. `decision` est au mieux `REQUIRES_REVIEW` et devient `BLOCKED` si l'un des seuils observables échoue. **L'endpoint ne délivre jamais de certification de mise en production.**

## Matrice d'évaluation reproductible

`npm run eval:agentic:local` exécute les tests des étapes 01 à 19, la suite de sécurité, les tests de référence CVComet et le contrôle de syntaxe. Les comptes viennent des sorties `node --test`; la matrice conserve seulement les nombres et le code de réussite, jamais le stdout du fournisseur, le contenu d'un CV ou une réponse modèle. Elle n'invente pas de score de factualité, de fiabilité ou de pertinence en ligne.

`npm run eval:agentic:staging` ajoute les tests d'intégration des étapes qui en possèdent un (04, 06–19), le typecheck sémantique et le build. **La recette avec Neon, LiveKit et un vrai fournisseur IA reste à lancer dans le staging déployé** et demande une vérification manuelle de l'authentification, des transactions et des actions validées.

## Préconditions de build

Le lockfile npm de la base source n'étant pas disponible ici, l'installation reproductible doit être préparée dans le dépôt de développement avant l'appel à `npm ci`. Le rapport d'audit local signale cette absence comme `NOT_VERIFIED`, et non comme un test de build réussi.

## Couverture manquante / hors périmètre

- Le registre `CareerAgentObservation` ne suit que le Career Assistant ; les exécutions directes du Resume Agent, Job Match ou Interview Voice ne disposent pas encore de métriques durables par appel et par agent. Les tests locaux ne comblent pas cette lacune.
- Le flux SSE des étapes précédentes décrit les tentatives de mission et peut manquer des événements si l'écriture de télémétrie a échoué. Les compteurs d'événements tool ne mesurent pas le taux de réussite de chaque outil.
- Les coûts `AIUsage` mélangent les fonctionnalités instrumentées de la plateforme ; attribution par agent et rapprochement avec facture fournisseur **non disponibles**.
- Le code n'effectue pas d'audit automatique du raisonnement privé des modèles ni du biais discriminatoire. Aucun pourcentage de `groundedness` n'est calculé sans dataset expert annoté et consenti.
- Pas de nouveau secret, de modification `.env` ou de télémétrie externe. La rétention existante reste applicable. Prévoir l'observation des volumes d'index et le vacuum PostgreSQL.

## Règles de sécurité

Toutes les décisions pouvant changer un CV, une candidature, une approbation, un paiement ou un email restent dans les workflows propriétaires ; ce graphe n'a aucun outil d'écriture. Un `GET` ne crée aucune mission. Le modèle ne peut ni modifier les seuils ni appeler les fonctions d'administration. Toute action d'évaluation supplémentaire exige une migration déployée et une validation sur environnement staging.
