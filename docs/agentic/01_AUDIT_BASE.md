# CVComet 3.0 — Migration LangGraph · Étape 01 / 20

## Statut

**Étape 01 : audit de la nouvelle base terminé ; passage à l’étape 02 autorisé par l’utilisateur.**
Aucun runtime applicatif, API, éditeur, design ou schéma Prisma n'est modifié à cette étape. Nous n'activons pas les anciens graphes LangGraph par supposition.

### Référence immuable

- Archive : `cvcomet(3).zip` (726 fichiers et 307 entrées de dossier dans le ZIP).
- SHA-256 : `6a00de192a24a46d826fd113bf4d3b763237fcf93ea7e4610134a6c66995ca1c`.
- Stack observée : Next.js 15.2.4, React 19, TypeScript, Prisma 6.5, PostgreSQL/Neon, Better Auth, Vercel AI SDK 4 ; worker LiveKit distinct.
- Dépendances déclarées **dans cette archive** : `@langchain/langgraph:^1.6.0`, `@langchain/core:^1.3.2`. Ces versions peuvent différer de la commande exécutée localement par l'utilisateur ; `node_modules` et fichier de lock absents de l'archive.

## 1. Architecture réellement en place

| Fonctionnalité | Entrée réelle | Service actuel | Migration prévue |
|---|---|---|---|
| Profil et import CV | `src/app/api/career-profile/import/route.ts` | `src/lib/career-profile/ai.ts` | 06 · Profile Agent |
| CV, Chat / Selected text | `src/app/api/cvs/[id]/assistant/route.ts` | `src/lib/resume-conversation-ai.ts`, `resume-ai/proposal-service.ts` | 07 · Resume Agent |
| Lettres de motivation | `src/app/api/cover-letters/[id]/assistant/route.ts` | `src/lib/cover-letter-ai/proposal-service.ts` | 08 · Cover Letter Agent |
| Contrôle ATS | `src/app/api/ats/route.ts` | `src/lib/career/ats-service.ts` | 09 · ATS Agent |
| Job Match | `src/app/api/job-match/route.ts` | `src/lib/career/job-match.ts` | 10 · Job Match Agent |
| Jobs for You | `src/app/api/find-jobs/for-you/route.ts` | `src/lib/find-jobs/for-you.ts` | 11 · Discovery Agent |
| Career Map | `src/app/api/career-map/route.ts` | `src/lib/career-map/service.ts` | 12 · Career Map Agent |
| Entretiens écrits | `src/app/api/interviews/route.ts` | `src/lib/career/interview.ts` | 13 · Interview Agent |
| Entretiens vocaux | `src/app/api/interviews/screening/start/route.ts` | `src/lib/career/screening.ts`, `workers/screening-agent.mjs` | 14 · Voice Agent / LiveKit |
| Dossiers | `src/app/api/career/v1/application-packets/route.ts` | `src/lib/career-os/application-packet-service.ts` | 15 · Application Agent |
| Career Assistant | `src/app/api/career/v1/agent/route.ts` | `src/lib/career-os/agent-service.ts` | 16 · Supervisor |
| Missions persistantes | routes Career Mission | `src/lib/career-os/mission-service.ts` | 17 · Mémoire multi-agents |

Le registre et les accès en lecture sont dans `src/lib/career-os/tool-registry.ts` et `policy.ts`. Les appels de modèles passent principalement par `src/lib/ai/model.ts` et `config.ts` (OpenAI, Google, Anthropic, Groq, Hugging Face). Le système existant gère quotas, réponses structurées, vérification des propriétaires et propositions de modifications soumises à approbation.

## 2. Constat décisif sur LangGraph — rectificatif étape 02

**Rectification vérifiée directement dans `cvcomet(3).zip`, SHA-256 inchangé** : cette archive déclare les dépendances LangGraph dans `package.json`, mais **ne contient aucun fichier de graphe LangGraph**, ni `docs/LANGGRAPH_MIGRATION_01.md` ni `scripts/langgraph-migration.test.cjs`. Le rapport initial avait attribué à tort des fichiers d'une autre base à cette archive. `agent-service.ts` et `api/job-match/route.ts` utilisent leurs services existants sans LangGraph. L'étape 02 ajoute donc le premier véritable graphe, dans `agents/demo`, sans brancher de parcours métier.


## 3. Tests de référence (31 octobre 2026)

| Contrôle effectué sans services externes | Résultat |
|---|---|
| `npm run test:cvcomet:baseline` (phases 00–13) | **190 réussis, 0 échec** |
| `npm run check:syntax` | **431 fichiers TS/TSX analysés, 0 erreur de syntaxe** |
| `npm run test:phase14` | **4 réussis** |
| `npm run test:p0p1` | **5 réussis, 1 échec** |
| `node --test scripts/langgraph-migration.test.cjs` | **Non applicable : fichier absent de cette archive (rectificatif étape 02)** |
| `node --test scripts/agentic-stage01.test.cjs` | **4 réussis, 1 échec initial lié à l’inventaire incorrect, corrigé étape 02** |

L'échec P0/P1 tient à une assertion statique sur le format exact de `conversation: { userId: actor.id }` dans `from-template/route.ts`. Le code actuel vérifie toujours le propriétaire avec un objet `conversation` multilignes ; **ce résultat seul ne démontre pas une faille de sécurité**. Le test doit être rendu structurel/robuste lors de sa maintenance et ne doit pas être neutralisé aveuglément.

**Non vérifiés ici :** `npm run typecheck`, `npm run build`, migrations Neon, intégration réelle des modèles, rendu navigateur, conversation LiveKit, performance de production. L'archive ne contient pas `node_modules` ni de lock de dépendances ; aucune clé utilisateur n'a été consultée ou modifiée.

## 4. Contraintes non négociables pour les étapes 02–20

1. **Une source de vérité** : profil professionnel ; lorsqu'un score concerne un CV, évaluer le contenu réellement présent dans ce CV.
2. **Zéro accès inter-comptes** : propriétaire vérifié côté serveur et revalidé à chaque action / reprise.
3. **Pas d'inventions** : aucun emploi, diplôme, chiffre, critère ou score fabriqué.
4. **Approbation explicite** : pas de sauvegarde d'un changement IA de document, d'envoi de candidature ou de mail sans contrôle humain. Le système n'envoie actuellement pas de candidature automatiquement.
5. **Scores déterministes** : l'IA aide à extraire et expliquer, les scores métier restent calculés et contrôlés par le backend.
6. **Outils existants réutilisés** : ne pas dupliquer les API ni les mécanismes de quota/facturation.
7. **Idempotence et reprises** : ne pas appliquer deux fois une action après un retry ou un redémarrage.
8. **Minimisation des données** : éviter de placer des données personnelles brutes dans les checkpoints, prompts de logs et traces.
9. **Budget et saturation de Neon** : contrôler pool, volume des checkpoints, rétention, concurrence et délai des tâches.
10. **UI inchangée sans demande** : ni thèmes, ni pages, ni éditeurs pendant la migration du runtime.

## 5. Risques et décisions architecturales

- **Deux moteurs incohérents :** les appels IA actuels sont directs ; il n’existe aucun graphe historique dans cette archive ; étape 02 introduit uniquement le noyau commun.
- **Durabilité :** aujourd'hui, les missions sont enregistrées en Prisma ; aucun checkpointer LangGraph n'est attaché aux deux graphes historiques. Les checkpoints persistants seront étudiés à l'étape 03, séparément de la mémoire métier.
- **Coût IA :** conserver les réservations de quota et mesures d'utilisation par appel, y compris quand un graphe relance un nœud.
- **Sécurité documentaire :** les propositions de CV et de lettres utilisent les révisions / signatures de preuves historiques ; ne pas supprimer les anciennes tables sans migration contrôlée.
- **Voice :** LangGraph orchestrera le contexte et le rapport, LiveKit assurera le flux audio temps réel ; ne pas transformer chaque trame en nœud LangGraph.
- **Tests fragiles :** certains tests comparent des chaînes de source plutôt que le comportement ; ajouter des tests d'exécution et des contrats de workflow au fil des étapes.

## 6. Étape 02 — périmètre autorisé après validation

Construire le **noyau commun LangGraph**, sans migrer encore les agents : état typé, contrat d'exécution, budget temps / annulation, erreurs structurées, événements d'étape et un graphe de démonstration **sans données privées et sans écriture**. Vérifier avec tests réellement exécutables (pas seulement une recherche de chaînes), et préserver les services existants. **Pas de checkpointer persistant avant l'étape 03.**

### Critère de passage à l'étape 02

Cet audit, le référentiel de tests et les contraintes de sécurité sont validés par l'utilisateur. Les écarts historiques ci-dessus sont consignés comme travaux à suivre, et ne sont pas présentés comme des tests réussis.

## 7. Livraisons cumulatives

La base de comparaison est exclusivement l'archive SHA-256 ci-dessus. **Chaque étape livre uniquement tous les fichiers créés ou modifiés depuis le début de cette migration, et non le projet entier ni seulement le dernier delta.** L'arborescence commence par `cvcomet/`.

Étape 01 : le présent audit, `01_inventory.json` et `scripts/agentic-stage01.test.cjs`.
Étape 02 : ces trois fichiers + les nouveaux composants de noyau / tests + mises à jour pertinentes de l'inventaire et des décisions.
Le même principe s'applique jusqu'à l'étape 20, après validation successive.
