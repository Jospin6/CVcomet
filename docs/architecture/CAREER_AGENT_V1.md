# CVComet Career Agent v1 — Étape 06

## Objectif

Faire de l'assistant carrière un **agent de consultation réelle** : un modèle planifie des appels d'outils, le serveur vérifie les permissions et les schémas, le résultat est renvoyé au modèle pour produire une réponse ancrée dans les données de l'utilisateur authentifié. Le moteur est **strictement en lecture seule** pendant cette étape.

## Flux

```text
POST /api/assistant (compatibilité UI) ou POST /api/career/v1/agent
  → session Better Auth, ID acteur fixé par le serveur
  → contrôle d'origine, requête JSON strictement bornée
  → fournisseur IA actif, réservation de quota n°1
  → generateObject : sélection d'au maximum 3 outils de lecture distincts
  → validateAgentCalls (liste fermée) + validation Zod propre à chaque outil
  → executeCareerReadTool(acteur issu de la session, arguments du modèle)
  → requêtes PostgreSQL filtrées par propriétaire, aucune élévation admin
  → mise en forme des résultats, limite 10 000 caractères par résultat
  → réservation de quota n°2
  → generateText : réponse fondée sur la question et les résultats
  → métriques de tokens enregistrées pour chaque invocation réussie
  → message + noms des outils utilisés (sans données brutes en UI)
```

Une demande avec zéro outil déclenche tout de même la phase de synthèse ; cela permet de répondre à une question générale sans interroger inutilement des données privées. L'utilisateur ne peut pas fournir directement un nom d'outil dans l'API agent ; seul le plan IA, validé côté serveur, contrôle la sélection. L'ancienne API explicite `/api/career/v1/tools` reste disponible pour les clients autorisés.

## Outils actifs (étape 06)

| ID | Autorité serveur | Statut |
|---|---|---|
| `get_my_profile` | profil de l'acteur connecté | lecture |
| `list_my_resumes` | CV appartenant à ses conversations | lecture |
| `get_my_resume` | CV filtré par `id` ET propriétaire | lecture |
| `list_my_applications` | candidatures de l'acteur | lecture |
| `list_my_confirmed_evidence` | uniquement faits confirmés par l'acteur | lecture |

**Désactivés :** envoi de candidature, emails, paiement, publication, modification de CV/lettre, accès aux données privées d'autrui. La présence d'un `approved: true` dans un prompt ou une réponse du modèle n'accorde aucun droit. Les outils non actifs ne peuvent pas être exécutés par le moteur.

## Données et limites

- Une confirmation dans Evidence Vault signifie **confirmée par l'utilisateur**, pas **certifiée par un tiers**.
- Les contenus de profil, CV et candidature doivent être qualifiés d'informations déclarées par l'utilisateur.
- Les descriptions, commentaires et autres documents reçus sont des **données non fiables** : jamais des instructions système.
- Maximum trois appels de lecture distincts par demande ; aucune boucle autonome sans limite.
- Une requête utilisateur est limitée à 6 000 caractères ; corps JSON plafonné à 8 KiB.
- Un appel d'outil ne peut contenir plus de 1 024 caractères d'arguments sérialisés.
- Chaque résultat transmis à l'IA est borné à 10 000 caractères, avec indication de troncature.
- Budget d'exécution serveur : environ 55 secondes ; planification IA limitée à 14 secondes ; réponse limitée au temps restant ; lectures annulables ou coupées par échéance.
- Planification : 400 tokens de sortie max ; synthèse : 1 200 tokens max ; aucun retry IA automatique.
- Deux réservations distinctes des limites d'usage, une **avant chaque appel IA** (dans le cas nominal). Cela consomme deux opérations de la limite de requêtes et six crédits de charge interne pour une réponse complète, indépendamment du nombre de lectures ; les crédits ne sont pas des USD.
- Traçabilité : opérations et tokens, pas de texte du CV, email, clés ou prompts dans les logs applicatifs du Career Agent.
- L'UI n'affiche que le nom des lectures effectivement réalisées, pas les résultats bruts ni des données sensibles.

## API v1

```
POST /api/career/v1/agent
Content-Type: application/json
Cookie: session Better Auth

{"apiVersion":"v1","message":"Quelles sont mes compétences confirmées ?"}
```

Réponse nominale sous enveloppe :

```
{"apiVersion":"v1","requestId":"...","data":{"message":"...","mode":"read_only","requiresApproval":false,"steps":[{"tool":"list_my_confirmed_evidence","status":"completed"}]}}
```

Compatibilité : l'API existante `/api/assistant` retourne directement `{message,mode,requiresApproval,steps}` pour ne pas casser le tableau de bord. Pas de migration Prisma ni de nouvelle variable d'environnement pour l'étape 06 : les fournisseurs IA, les quotas et les sessions existants sont réutilisés.

## Limites volontaires et risques restants

1. Un **plan à une seule vague** ne permet pas encore d'enchaîner une découverte de CV puis sa lecture approfondie dans la même requête si son UUID n'est pas connu. L'agent peut demander à l'utilisateur de sélectionner un CV. L'orchestration multi-étapes persistante arrive à l'étape 07.
2. Les erreurs de fournisseur IA ou de quota peuvent interrompre une requête après la phase de planification. Aucune mutation de document n'a lieu.
3. La défense contre les injections de prompt est une combinaison de séparation système/données, contrat strict et contrôles de permission ; elle ne constitue pas une garantie qu'un LLM ignorera toute instruction malveillante. Tester avec une bibliothèque d'attaques en préproduction.
4. Pas de streaming, mémoire longue durée, supervision des jobs, outils d'écriture ni confirmations persistées dans cette phase.
5. Les tests intégrés avec fournisseur IA, Better Auth, PostgreSQL et build complet restent à exécuter sur un environnement de recette disposant des dépendances, secrets et services réels.

## Scénarios de recette à vérifier en staging

- Profil et Evidence Vault vide ; question générale sans besoin d'outil ; échec du fournisseur IA ; dépassement des quotas ; réponse sans contenu.
- Question sur des compétences confirmées ; vérifier que les compétences simplement suggérées ne sont jamais présentées comme vérifiées.
- Demande d'un CV d'un autre utilisateur, y compris avec rôle admin et UUID connu ; résultat 404 sans divulgation.
- Demande « envoie immédiatement ma candidature » ; réponse explicative, **aucun email ni écriture**.
- Plusieurs onglets ou utilisateurs concurrents, confirmation révoquée pendant la consultation, entrées volumineuses, déconnexion / annulation.
- Tester OpenAI, Gemini, Anthropic, Groq et Hugging Face selon les modèles réellement configurés ; certains modèles peuvent refuser les sorties JSON structurées.

## À suivre

L'étape 07 apportera mémoire de conversation et **missions persistantes**, suivi des états, reprises, idempotence et véritable protocole d'approbation des actions. Ces capacités ne sont pas annoncées comme déjà implémentées ici.
