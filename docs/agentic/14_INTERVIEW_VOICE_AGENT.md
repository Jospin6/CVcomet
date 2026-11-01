# CVComet LangGraph — Étape 14/20 · Interview Voice Agent

## Périmètre

La simulation d'entretien vocal existait déjà dans CVComet avec une salle LiveKit, un agent OpenAI Realtime (`cvcomet-screening`), un consentement explicite, un CV et une candidature appartenant à l'utilisateur et un rapport sauvegardé en Prisma. Cette livraison **n'invente pas un second service de voix**. Elle remplace la préparation des consignes et l'évaluation finale par deux graphes LangGraph **effectivement appelés par les routes existantes**.

Les fonctionnalités audio WebRTC, les jetons de salle et la transcription LiveKit restent dans le worker `workers/screening-agent.mjs`. **Aucun fragment audio ne passe par LangGraph**, et cette étape n'ajoute aucun enregistrement ni egress audio.

## Architecture

`src/lib/agentic/agents/interview-voice/`

- `agent/state.ts`, `agent/graph.ts`, `agent/interview-voice.agent.ts` : états éphémères, graphes et point d'entrée lié à l'identité du propriétaire.
- `nodes/context.node.ts` : vérifications de format et limites.
- `nodes/prepare.node.ts` : instructions d'entretien pour LiveKit.
- `nodes/generate.node.ts` : évaluateur appelé une seule fois sur les réponses transcrites (au moins deux réponses exploitables).
- `nodes/verify.node.ts` : preuves textuelles, six notes et résultat pédagogique.
- `nodes/assemble.node.ts` : construction des sorties vérifiées.
- `tools/contracts.tool.ts`, `tools/validation.tool.ts` : données autorisées, contrôles de bornes, calcul du score final.
- `prompts/voice.prompt.ts` : messages pour la simulation et la génération du rapport, séparés du reste du code.

### Graphe A — Préparation vocale

`context → prepare → verify → assemble`

L'API `GET /api/interviews/screening/internal?sessionId=...`, protégée par secret serveur, appelle `getScreeningForWorker()`. Cette fonction vérifie la session `VOICE_ACTIVE`, le consentement, la salle et la capture immutable CV/offre, puis lance `runVoicePreparationAgent()` avec l'identité propriétaire. L'agent retourne `sessionId`, `roomName`, `language`, `instructions`, `openingInstructions` ; le worker utilise **les consignes issues du graphe** pour le modèle Realtime. Le contenu fourni par l'utilisateur (CV, description du poste, nom de l'employeur) reste marqué comme données non fiables, sérialisé en JSON.

### Graphe B — Évaluation vocale

`context → generate → verify → assemble`

Au terme du flux LiveKit, le worker envoie à `POST /api/interviews/screening/internal` les tours textuels finaux sous le secret serveur. La route contrôle la taille réelle du corps (200 Ko), le schéma, la salle et le consentement. `completeScreening()` appelle `runVoiceEvaluationAgent()`. L'adaptateur IA réutilise le fournisseur existant (`getAIModel`, `generateObject`) et le quota `reserveProfileAI()` avant le coût modèle. L'agent transmet `AbortSignal` et limite son budget à 38 secondes.

Le modèle ne fournit pas le score final : six notes 0–100 sont validées, **la moyenne est recalculée par le code**, et au moins **deux citations verbatim provenant de deux réponses distinctes du candidat** doivent être trouvées dans le vrai transcript. Une note invalide, un extrait fabriqué, moins de deux réponses, un échec de quota ou une indisponibilité du fournisseur produisent `VOICE_UNGRADED` et `overallScore: null`. Les scores sont des retours d'entraînement, **jamais des probabilités de recrutement**. L'accent, le dialecte et la vitesse d'élocution ne sont pas des critères.

Seul le service Prisma sauvegarde le résultat et la transcription. Une transition atomique `VOICE_ACTIVE/VOICE_ENDING → VOICE_EVALUATING`, effectuée **avant** la réservation IA et le fournisseur, empêche deux callbacks simultanés de déclencher deux évaluations. Une seconde transition transactionnelle `VOICE_EVALUATING → COMPLETED/VOICE_UNGRADED` avec `updateMany` compare-and-swap protège l'enregistrement de la transcription contre les rejeux. Le worker réessaie jusqu'à trois fois la finalisation lors d'un problème réseau, sans conserver d'audio ni de transcription sur disque. Les données personnelles ne sont pas journalisées par les nœuds du graphe.

## Déploiement

Conserver les variables existantes (aucune valeur ni aucun fichier `.env` n'a été modifié) :

- Next.js : `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `CVCOMET_VOICE_WORKER_SECRET`, fournisseur IA et base Prisma/Neon.
- Worker permanent : les mêmes variables LiveKit, `OPENAI_API_KEY`, `CVCOMET_INTERNAL_URL`, `CVCOMET_VOICE_WORKER_SECRET`. `CVCOMET_INTERNAL_URL` doit être HTTPS hors `localhost`.

Le worker doit être un processus séparé : `npm run worker:screening` (ou `worker:screening:dev`). Prévoir une exécution **horaire** de `npm run maintenance:voice-interviews` sur un hôte fiable et sécurisé : la commande clôt les sessions vocales inactives depuis plus de 45 minutes par `VOICE_UNGRADED`, sans créer de faux score. Cette commande n'est pas planifiée automatiquement par le ZIP. Le nom enregistré **reste exactement** `cvcomet-screening`, car le dispatch de la route Start y est lié. La connexion navigateur passe par le jeton LiveKit à durée de vie limitée et reste liée à une salle opaque.

## Vérifications recommandées

```bash
npm install
npx prisma generate
npm run test:agentic:stage14
npm run test:agentic:stage14:integration
node --experimental-strip-types --test scripts/interviews-screening-2026.test.mjs
npm run test:phase10
npm run typecheck
npm run build
npm run worker:screening:dev
```

Recette avec Neon/LiveKit/OpenAI réels : autoriser puis refuser le consentement ; tester un CV et une candidature appartenant à l'utilisateur et un accès interdit ; vérifier les sous-titres utilisateur/assistant, une question à la fois, micro ON/OFF, raccrochage, salle réellement fermée, historique privé et rapport fondé sur les réponses ; tester une déconnexion, un échec fournisseur, une reprise de requête et une tentative d'envoi avec mauvaise salle.

## Limites non masquées

1. Le fonctionnement effectif du worker, du transport WebRTC, du modèle vocal Realtime et du schéma Prisma **n'a pas été testé ici contre les services hébergés**.
2. Le contrôle de score impose des citations vérifiées, mais le jugement des dimensions et les conseils restent issus d'un modèle ; un contrôle humain reste nécessaire pour des usages conséquents.
3. Si le worker disparaît et que ses trois tentatives échouent, une session peut rester en attente jusqu'à ce que la commande **`maintenance:voice-interviews` soit effectivement programmée**. Cette tâche clôt les sessions abandonnées comme non notées, mais ne reconstitue pas la transcription manquante. Ajouter une alerte opérationnelle pour chaque cas.
4. Le verrou durable `VOICE_EVALUATING` évite la double évaluation pendant les callbacks concurrents ; il n'existe pas de reprise exacte du même appel modèle après un crash avant l'écriture du rapport. La tâche de réconciliation clôt cette session comme non notée après expiration.
5. La génération du rapport utilise une fenêtre bornée de transcription (jusqu'à 36 tours, extraits courts) pour éviter la saturation du modèle ; le texte complet reçu peut être sauvegardé en base selon le consentement. Les entretiens très longs nécessitent une stratégie de synthèse par segments.
