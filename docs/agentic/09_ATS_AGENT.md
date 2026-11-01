# Étape 09/20 — ATS Agent LangGraph

## Objectif

Migrer l'évaluation ATS existante vers un véritable graphe LangGraph, **sans changer** l'interface ATS, la structure de réponse `ATS_REPORT_V2`, les scores métier, le cache, les permissions, la sélection d'offre ou l'enregistrement Prisma.

**Base :** `cvcomet(3).zip` + modifications cumulées 01–08.

## Arborescence

```text
src/lib/agentic/agents/ats/
├── agent/
│   ├── state.ts
│   ├── graph.ts
│   └── ats.agent.ts
├── nodes/
│   ├── plan.node.ts
│   ├── model.node.ts
│   ├── review.node.ts
│   ├── job-match.node.ts
│   ├── assemble.node.ts
│   └── verify.node.ts
├── tools/
│   ├── plan.tool.ts
│   ├── analysis.tool.ts
│   ├── assemble.tool.ts
│   └── verify.tool.ts
└── prompts/
    └── review.prompt.ts
```

## Graphe réellement branché

`POST /api/ats` -> `runAtsAgent` :

1. **plan** : réduit le CV aux sections visibles ; réévalue toute analyse d'offre enregistrée selon le texte exact ; décide `none` / `saved` / `extract`.
2. **model** : récupère le fournisseur IA configuré. Réserve exactement une consommation `ATS_REVIEW` après obtention du fournisseur ; si indisponible, prépare un rapport partiel honnête.
3. **review** et **job-match**, en **branches parallèles** : relecture sémantique fondée sur des citations de CV ; comparaison avec l'offre, en n'utilisant que les contenus visibles. Sans offre, l'analyse d'offre n'est pas exécutée. Une analyse validée et déjà enregistrée ne déclenche pas d'extraction IA supplémentaire.
4. **assemble** : réutilise `analyzeResume`, la grille déterministe de 100 points, les contrôles PDF et les priorités existantes. Les recommandations pour exigences non démontrées exigent de vraies preuves ; aucune compétence n'est inventée.
5. **verify** : contrôle la version du rapport, les plages de score et les cas non évalués. Interdit tout `overallScore` prétendant simuler une probabilité d'embauche ou un score propriétaire ATS.

## Sécurité et données

- L'API contrôle l'identité, la propriété du CV et de l'offre avant le graphe.
- `POST /api/ats` préserve son `fingerprint`, son cache et la sauvegarde dans `atsAnalysis`.
- Les champs `contact.*` sont vérifiés **localement** et ne sont plus transmis au prompt de relecture.
- Les instructions de l'offre et des champs du CV sont traitées comme données non fiables, jamais comme commandes d'outils.
- Le modèle ne fixe aucun score et ne modifie jamais le CV. Les éventuels `proposedText` sont soumis à la vérification des citations et des nombres dans `validateAtsReview` et ne sont **pas** appliqués.
- Aucun checkpointer n'est utilisé pour ce graphe : les données brutes du CV et de l'offre restent éphémères. Seul le rapport validé continue d'être conservé par l'API existante.
- `ats-service.ts` est conservé provisoirement comme référence de comparaison (ancien service) ; il n'est plus appelé par la route ATS. Son retrait sera envisagé lors de la consolidation après vérification des régressions.

## Limites

- LangGraph coordonne les étapes : il ne reproduit pas le comportement d'un ATS propriétaire et ne prédit pas l'embauche.
- L'ATS peut préparer des suggestions concrètes, mais ne peut pas appliquer les modifications. Leur orchestration avec Resume Agent sera réalisée après les agents spécialisés, via Application Agent et Career Supervisor.
- Le workflow ne dispose pas encore d'un système de checkpoints pour les données personnelles (choix intentionnel de confidentialité). Les analyses sont rejouables par l'utilisateur et mises en cache en cas de résultat complet.
- Le build complet et l'intégration réelle avec `StateGraph`, Prisma, Neon et le fournisseur IA doivent être vérifiés sur le projet installé.
