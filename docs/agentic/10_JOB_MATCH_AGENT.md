# Étape 10/20 — Job Match Agent LangGraph

## Périmètre livré

`POST /api/job-match` appelle désormais `runJobMatchAgent` pour comparer l'offre à un profil et, le cas échéant, au CV possédé par l'utilisateur. La page `/dashboard/job-match` et ses onglets **Overview / Improvements / Requirements / Prepare** restent inchangés dans leur navigation et leur style ; le panneau Prepare expose désormais un plan de préparation du CV, **non appliqué** automatiquement.

### Workflow réel

`plan → extract → compare → verify → prioritize → assemble`

- `plan` : vérifie si une analyse d'offre enregistrée est toujours ancrée dans le texte réel ; sinon, elle n'est pas réutilisée.
- `extract` : réutilise l'extracteur IA existant, sa validation des extraits de l'offre et ses critères REQUIRED / PREFERRED / MENTIONED. Le modèle n'analyse pas les données personnelles du candidat pour cette extraction.
- `compare` : cherche les preuves dans le profil et le CV via `careerEvidence`; conserve l'algorithme de `matchJob`, ses statuts DEMONSTRATED / PARTIAL / NOT_DEMONSTRATED / VERIFY et ses pondérations métier.
- `verify` : recalcule les scores et les statuts depuis les mêmes sources, vérifie les citations de l'offre et l'appartenance des preuves au profil/CV effectivement fourni. En cas d'incohérence, le graphe échoue sans sauvegarder un score.
- `prioritize` : ordonne les actions selon MUST / PREFERRED / MENTIONED et l'incertitude, avec au maximum 12 entrées. La provenance des éléments est conservée par chemin (profil vs CV) ; les lacunes ne sont jamais transformées en faits.
- `assemble` : retourne l'analyse source, le match validé et une liste `result.resumePlan`, qui ne contient ni nouveau contenu inventé ni commande exécutable.

## Arborescence

```text
src/lib/agentic/agents/job-match/
  agent/    state.ts, graph.ts, job-match.agent.ts
  nodes/    plan, extract, compare, verify, prioritize, assemble
  tools/    plan, extract, compare, verify, resume-actions
  prompts/  improvements.prompt.ts
```

## Intégration et contraintes

L'API préserve l'authentification, la propriété du CV et de la candidature, `requireFeature(JOB_MATCH)`, `reserveProfileAI(JOB_ANALYSIS)`, le dédoublonnage en mémoire, le cache SHA-256 et la transaction Prisma. Le `fingerprint.version` passe de 2 à 3 pour ne pas recycler silencieusement d'anciens rapports dépourvus du plan. Les analyses déjà enregistrées, vérifiées contre le texte d'offre exact, ne consomment pas de nouvel appel IA. Une analyse invalide/stale doit être réextraite avec contrôle de quota.

Aucun checkpointer LangGraph n'est branché : le texte de l'offre et le profil ne sont pas enregistrés dans des événements de progression ou des états persistants. Les résultats validés sont enregistrés par l'API existante. L'IA n'assigne jamais le score final. Les indications de score ne sont pas une probabilité d'embauche.

Les actions `resumePlan` ne sont pas des propositions acceptées. Le bouton du panneau Prepare conduit à la **proposition existante** `/api/tailor-resume` (PROPOSE). L'acceptation reste une action distincte **ACCEPT**, au choix de l'utilisateur. Aucune publication, envoi, modification de CV ou candidature automatique n'est déclenchée.

## Compatibilité et limites

- Aucun schéma ou migration Prisma, aucune clé ou variable d'environnement créée.
- Le format `MatchResult.version = 1`, les scores, les champs Prisma et les règles métier sont conservés ; `resumePlan` est un champ **optionnel** enrichi.
- L'interface ne change pas la page globale et n'ajoute pas de pop-up.
- Le graphe ne remplace pas le moteur existant d'adaptation du CV et ne le pilote pas automatiquement : il produit uniquement un plan consultable.
- Les validations de build complet nécessitent les dépendances Next.js, Prisma, LangGraph et le fournisseur IA du projet installé ; aucune réussite de production n'est présumée.
