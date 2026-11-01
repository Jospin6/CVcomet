# Étape 07/20 — Resume Agent LangGraph

**Base de référence :** `cvcomet(3).zip` + correctifs cumulatifs validés 01 à 06.  
**Statut :** code livré, intégration réelle LangGraph / typecheck / build à valider dans l'environnement disposant des dépendances npm.

## Périmètre de la migration

La nouvelle implémentation n'a **pas** réorganisé l'éditeur, la galerie de templates, les onglets Chat / Selected text ni le panneau ATS. Elle n'a pas modifié les schémas Prisma.

Trois entrées métier utilisent le **Resume Agent** :

1. `POST /api/cvs/[id]/assistant` : conversation générale dans Open tools et modification ciblée `targetField` ; charge le CV appartenant à l'utilisateur, vérifie la révision, récupère les faits professionnels et l'offre associée, demande au graphe de préparer des opérations, puis enregistre une **proposition** avec le service existant `proposeResumeAI`.
2. `proposeApplicationDraft(..., "resume", ...)` : même agent, avec le CV et l'offre de la candidature appartenant au demandeur ; la proposition est soumise au même mécanisme de décision.
3. `POST /api/resume-ai` : génération et reformulation de **texte de champ** (`GENERATE`, `IMPROVE`, `SHORTEN`, `PROFESSIONAL`, `GRAMMAR`, `ATS`) dans un graphe distinct du même agent ; renvoie toujours `{ proposal: string }`, sans sauvegarde automatique.

Le endpoint `/api/cvs` pour créer un CV vierge ou le préremplir avec le profil reste déterministe. Il n'a pas besoin d'appeler un LLM pour copier des faits déjà fournis. Le parcours `/api/tailor-resume` de Job Match reste inchangé et sera migré avec l'agent spécialisé de l'étape 10 ; le Resume Agent peut déjà reformuler/adopter le contenu pour une offre liée dans l'éditeur et dans une candidature.

## Séparation stricte des responsabilités

```
src/lib/agentic/agents/resume/
├── agent/
│   ├── state.ts                # État du graphe de conversation
│   ├── graph.ts                # Plan -> Generate -> Verify -> Review
│   ├── resume.agent.ts         # Point d'entrée serveur
│   ├── field-state.ts          # État de la génération de champ
│   ├── field-graph.ts          # Plan -> Generate -> Verify -> Review
│   ├── field.agent.ts          # Point d'entrée génération
│   └── errors.ts               # Adaptation des erreurs publiques
├── nodes/
│   ├── plan.node.ts
│   ├── generate.node.ts
│   ├── verify.node.ts
│   ├── review.node.ts
│   ├── field-plan.node.ts
│   ├── field-generate.node.ts
│   ├── field-verify.node.ts
│   └── field-review.node.ts
├── tools/
│   ├── plan-edit.tool.ts       # Planification et champ sélectionné
│   ├── generate-edit.tool.ts   # Modèle + quota existants
│   ├── verify-edit.tool.ts     # Validation/réapplication des changements
│   ├── field-generation.tool.ts
│   └── field-review.tool.ts
└── prompts/
    ├── resume-edit.prompt.ts
    └── resume-field.prompt.ts
```

### Graphe 1 — Chat et Selected text

- **Plan :** route entre une modification générale, une sélection ciblée, une adaptation à une offre liée et une demande de clarification sans appel payant.
- **Generate :** appelle le générateur structuré **existant**, avec son fournisseur actif, la politique de localisation, le quota `RESUME_EDIT`, l'historique borné et un signal d'annulation.
- **Verify :** valide les chemins d'édition via Zod, écarte les modifications hors du champ sélectionné, *réapplique* les opérations sur la version reçue du CV (jamais le snapshot fourni par le modèle), vérifie les chiffres et rejette les changements sans effet.
- **Review :** rend une proposition, ou une clarification. **Aucun nœud de sauvegarde.** La création de la proposition et son approbation restent gérées par `proposeResumeAI` / `decideResumeAI` : propriétaire, révision, expiration, contrôle des sources, version antérieure et transaction Prisma.

### Graphe 2 — Génération de texte de champ

- Planifie la génération à partir du profil et des notes utilisateur.
- Appelle le `cvcometAgentModel.text` de l'étape 04 (fournisseur et quota uniques).
- Contrôle les nombres introduits et les réponses vides.
- Rend un texte candidat à insérer **manuellement**, sans toucher à la base.

## Confidentialité, autorisations et quotas

- Les identifiants des documents sont contrôlés **avant** le graphe, côté serveur et avec l'utilisateur authentifié.
- L'agent n'a pas accès à une identité choisie par le modèle.
- Les descriptions de postes et contenus de CV sont des **données non fiables** : ils ne peuvent pas remplacer les instructions système.
- **Pas de checkpointer** pour ces graphes : leurs états contiennent du texte de CV personnel. L'étape 03 fournit les checkpoints pour d'autres missions à état limité ; les revues de CV restent dans `ResumeAIProposal` avec expiration.
- Les événements du runtime restent des métadonnées sans contenu de CV.
- Aucun modèle ne doit pouvoir appliquer directement une modification, envoyer une candidature ou publier un document.
- Chaque demande de génération qui invoque un modèle réserve le quota `RESUME_EDIT` ; une clarification sans appel modèle ne réserve rien.

## Limites assumées

- Le service Job Match `/api/tailor-resume` est toujours indépendant jusqu'à l'étape 10.
- Le système de vérification des faits contrôle notamment les affirmations chiffrées ; cela **ne certifie pas** l'exactitude sémantique de toute reformulation. Une revue utilisateur est toujours indispensable.
- Le graphe d'édition ne reprend pas une génération interrompue : on ne persiste pas les CV bruts dans LangGraph. La **proposition validée** est conservée séparément pour acceptation/refus.
- Tests de typecheck, build et appel réel au fournisseur IA à exécuter sur l'installation de l'utilisateur ; aucun de ces résultats n'est simulé dans la documentation.
