# CVComet LangGraph — Étape 15/20 · Application Agent

## Objectif et périmètre réel

L'écran existant `/dashboard/application-agent` prépare un **dossier de candidature à usage manuel**. L'étape 15 intègre LangGraph dans les deux opérations de préparation existantes, sans créer un service d'envoi ni automatiser une candidature :

1. `POST /api/career/v1/application-packets` — prépare un brouillon sobre à partir d'une offre, d'un CV, d'une lettre facultative et d'une mission facultative, après vérification des associations et du propriétaire.
2. `POST /api/career/v1/application-packets/[id]/suggest-email` — génère **uniquement une proposition** d'email basée sur des faits de profil auto-déclarés, contrôlée contre les inventions par l'outil métier existant.

Les routes GET, PATCH, DELETE et l'action d'approbation sont conservées. L'approbation mène à `READY`, c'est-à-dire *prêt pour utilisation manuelle* ; jamais *envoyé*.

## Architecture de l'agent

`src/lib/agentic/agents/application/`

- `agent/state.ts` : états éphémères de deux graphes ; aucun checkpointer enregistrant les emails ou le profil.
- `agent/graph.ts` : chaînes de nœuds et événements sécurisés ; graphe runtime `@langchain/langgraph`.
- `agent/application.agent.ts` : identité du demandeur, budget temporel, exécution contrôlée.
- `nodes/context.node.ts` : validation stricte des données d'entrée.
- `nodes/draft.node.ts` : réemploi de la politique de rédaction déterministe actuelle.
- `nodes/generate.node.ts` : appel à l'adaptateur de modèle, gestion sûre des pannes et quotas.
- `nodes/verify.node.ts` : contrôle structurel, puis garde factuelle injectée depuis la route.
- `nodes/assemble.node.ts` : restitution d'un brouillon ou d'une proposition contrôlée.
- `tools/contracts.tool.ts` : contrats typés, dont dépendances du modèle et du vérificateur.
- `tools/validation.tool.ts` : limites, vérification des sorties, refus de prétendre que le dossier est joint ou envoyé.
- `prompts/email.prompt.ts` : instructions système séparées du texte d'offre et des faits auto-déclarés (JSON non fiable).

### Graphe A — Assemblage déterministe

`context → draft → verify → assemble`

`createApplicationPacket()` conserve les validations existantes : `jobOpportunity.userId`, CV lié à une conversation de l'utilisateur, lettre et mission appartenant au même compte, cohérence lettre–offre–CV, `requestKey` et `intentHash` anti-rejeu. **Après** ces validations, il appelle `runApplicationPacketAgent()`. La création Prisma continue de s'exécuter **hors du graphe**, avec l'unicité `(userId, requestKey)` et la récupération en cas de collision `P2002`. Une requête rejouée avec la même intention ne réexécute pas le graphe.

Le brouillon initial utilise `draftApplicationEmail()` de la politique historique, sans appel IA ni coût modèle. Il ne revendique aucune compétence ou expérience.

### Graphe B — Suggestion IA en lecture seule

`context → generate → verify → assemble`

La route vérifie l'authentification, l'origine, la propriété du dossier, le statut `DRAFT`, sa révision exacte, les révisions du CV et de la lettre, ainsi que la version de l'offre. Elle réutilise `getProfileFacts()`, `requireFeature("COVER_LETTER")`, `getAIModel()`, `reserveProfileAI("APPLICATION_EMAIL")`, `generateObject()` et `assertDocumentFacts()`. Le prompt exige une rédaction naturelle, sans diplômes, chiffres, réalisations, expériences, adresses ou pièces jointes inventés. L'annonce est une donnée, jamais une instruction.

Une sortie insuffisante, non conforme ou rejetée par le garde factuel **n'est pas exposée** : `SUGGESTION_REQUIRES_REVIEW` (422). Les pannes de fournisseur sont ramenées à un code technique sûr. La route recontrôle le dossier et les révisions **après** l'appel au modèle, afin de refuser une proposition devenue obsolète pendant la génération.

La réponse conserve exactement le contrat frontend : `{ suggestion, saved: false, sent: false, reviewed: false }`. Le bouton « Enregistrer » appelle le PATCH existant ; l'utilisateur coche ensuite la revue explicite avant approbation. Aucun courrier ni candidature n'est envoyé.

## Sécurité et limites

- **Pas de décision autonome sensible** : aucune action `submit_application`, `send_application_email` ou SMTP n'est ajoutée. Ces outils restent `available:false` dans le catalogue.
- **Zéro accès inter-comptes** : sélection Prisma scindée par `actor.id`, y compris après le temps d'attente de l'appel IA ; la décision se déroule dans une transaction sérialisable avec contrôle de révision optimiste.
- **Données minimales dans le graphe** : titre, entreprise, langue, nom de signature pour le brouillon ; offre tronquée, au plus 50 déclarations et termes techniques bornés pour la suggestion. Les nœuds n'écrivent pas en base et ne journalisent pas ces données.
- **Aucune notation d'embauche** : le module ne calcule pas de score, ni probabilité de recrutement.
- **Coûts** : la réservation IA n'a lieu que pour une suggestion volontaire. Le graphe de brouillon initial reste déterministe.
- **Idempotence** : garantie par le service Prisma pour la création, pas par un second stockage LangGraph. La proposition IA est volontairement non persistée ; plusieurs clics peuvent consommer plusieurs quotas (comportement déjà présent).
- **Consentement / vérification humaine** : le bouton d'approbation a toujours besoin de la revue explicite et ne change pas d'état en cas de sources modifiées.

## Tests et recette

```bash
npm install
npx prisma generate
npm run test:agentic:stage15
npm run test:agentic:stage15:integration
npm run test:phase09
npm run test:cvcomet:baseline
npm run check:syntax
npm run typecheck
npm run build
```

Recette applicative avec Neon + fournisseur IA : créer un dossier lié au compte ; rejouer la clé idempotente, puis la réutiliser avec une intention différente ; tenter un CV ou une lettre appartenant à un autre utilisateur ; modifier le CV ou le poste pendant la génération ; vérifier refus de la prévisualisation ; demander une suggestion contenant une compétence non démontrée ; vérifier l'absence de sauvegarde automatique ; approuver après sauvegarde avec `reviewed:true` ; contrôler que `READY` n'est ni envoyé ni soumis ; tester timeout, absence de crédits et erreur fournisseur.

## État de validation dans cet environnement

- `npm run test:agentic:stage15` : 12 tests réussis avec vrai code de validation et graphes simulés.
- `npm run test:agentic:stage10` à `stage14` : 64 tests de non-régression réussis.
- `npm run test:phase09` : 12 tests historiques de dossiers de candidature réussis.
- `npm run test:cvcomet:baseline` : 190 tests réussis.
- `npm run check:syntax` : 628 fichiers TS/TSX analysés, aucune erreur de syntaxe.
- **Non validés** : test avec le moteur LangGraph installé, typecheck sémantique, build Next.js, tests Prisma/Neon et fournisseur IA réels (le ZIP ne contient pas de `node_modules`). Les problèmes globaux de résolution de modules dans le typecheck sans dépendances ne sont pas présentés comme des erreurs applicatives corrigées.
