# CVComet 3.0 — Étape 16/20 : Career Assistant Supervisor

## Objectif atteint

Le Career Assistant des routes `POST /api/assistant`, `POST /api/career/v1/agent` et des conversations persistantes `/api/career/v1/missions/:id/runs` passe désormais par un **vrai graphe LangGraph à routage conditionnel**, avec la même API publique et les mêmes protections de mission qu'avant.

Les chemins précédents continuent d'appeler `runCareerAgent`. Le service est devenu l'adaptateur du graphe : il apporte l'identité issue de la session, le fournisseur IA, les quotas, les audits de coûts et les outils existants.

## Graphe et séparation de fichiers

```
context → route ─┬→ general ────────────────┐
                 ├→ profile ────────────────┤
                 ├→ resume ─────────────────┤
                 ├→ cover_letter ───────────┤
                 ├→ ats ────────────────────┤
                 ├→ job_match ──────────────┤
                 ├→ job_discovery ──────────┤
                 ├→ career_map ─────────────┤
                 ├→ interview_text ─────────┤
                 ├→ interview_voice ────────┤
                 └→ application ────────────┤
                                           ↓
                                      respond → verify → assemble
```

- `src/lib/agentic/agents/supervisor/agent/` : `StateGraph`, état et entrée contrôlée.
- `nodes/` : contexte, routage, délégation en lecture, génération de réponse, vérification et assemblage.
- `tools/` : types, énumérations fermées, politiques par spécialiste, validation des arguments et du contexte.
- `prompts/` : règles de sélection des spécialistes et consignes de réponse propres aux domaines.

`route` demande au modèle de sélectionner **un seul domaine** et au plus trois outils, puis la politique serveur **revalide** l'intention, chaque outil et ses arguments. `addConditionalEdges` sélectionne une seule branche de consultation. Les outils existants conservent la vérification de propriété dans Prisma. Un `applicationId` reçu dans l'API est relu obligatoirement côté serveur, indépendamment du plan proposé par le modèle.

## Périmètre réel de la délégation

Les onze branches sont des **adaptateurs de consultation spécialisés en lecture seule**. Elles ne font **pas** tourner arbitrairement les graphes complets des agents métiers : ceux-ci exigent des ressources typées, des preuves contrôlées, des permissions métier et, pour les brouillons, une confirmation explicite. Par exemple :

- Demander des conseils sur un CV peut lire la liste de CV ou un CV appartenant à l'utilisateur. **Modifier** ce CV doit passer par l'éditeur ou le brouillon révisable prévu aux étapes 7 et 15.
- Demander des recommandations d'offres peut consulter les préférences de profil. **Lancer la découverte d'annonces réelles** doit passer par Jobs for You (étape 11) : le chat ne fabrique pas une recherche d'offres.
- Interroger un match sauvegardé exige un vrai identifiant de match, autorisé côté base. Une analyse Job Match fraîche se fait dans son workflow (étape 10).
- Entraînement vocal : aucune salle LiveKit n'est lancée par un message. La permission et le consentement restent dans Interview Voice (étape 14).
- Les candidatures et emails ne sont jamais soumis ni envoyés dans le superviseur ; leur préparation demeure sujette aux validations des écrans métiers (étape 15).

Il ne s'agit **pas** d'un système autonome multi-étapes capable d'exécuter des actions arbitraires. Les spécialisations de chat et les sous-agents métier sont volontairement découplés par la sécurité.

## Sécurité et compatibilité

- Identité de l'utilisateur vérifiée dans les routes puis dans l'entrée du superviseur ; aucun `userId` de modèle ou de requête n'est accepté comme autorité.
- Messages limités à 6 000 caractères, historique contrôlé et plafonné, trois lectures distinctes maximum.
- Pour chaque spécialiste, liste fermée de lectures disponibles et schémas stricts d'arguments.
- Aucune écriture dans la délégation, aucun nouvel endpoint d'exécution d'actions, ni élévation de permission.
- Deux appels modèle au maximum, avec **deux réservations distinctes** et audits de jetons/coûts comme avant.
- Budget de 55 secondes, interruption propagée aux appels modèle et aux lectures ; pas de boucle autonome de sous-agents.
- Événements du noyau : métadonnées techniques uniquement. État éphémère, pas de checkpoint contenant CV ou historique privé.
- Réponse finale passée par `assertAgentAnswer` et `reviewCareerAgentAnswer` ; ce filtre ne constitue pas une garantie absolue contre les hallucinations.
- Codes connus d'autorisation et quota préservés ; erreur fournisseur inconnue convertie en code générique.
- Historique, idempotence, verrou de mission, approbation des brouillons et API restent portés par les services existants.
- **Aucune modification** du schéma Prisma, des variables `.env`, des workers LiveKit ni des routes de soumission.

## Points encore à valider avant production

- Installer les dépendances et lancer le test **réel** `StateGraph` ; les tests locaux ont simulé ce runtime.
- `npm run typecheck` et `npm run build` après `npm ci` et `npx prisma generate`.
- Recette des trois routes d'assistant, des missions sauvegardées, des flux de validation des brouillons, du quota, de l'annulation et des erreurs en environnement de test avec Neon et fournisseur IA.
- Évaluation de la justesse du routage sur un ensemble de conversations françaises/anglaises et de demandes ambiguës.

La prochaine étape doit rester hors de cette livraison tant que l'étape 16 n'est pas validée.
