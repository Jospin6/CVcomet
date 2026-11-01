# Étape 11/20 — Job Discovery Agent — Jobs for You

## Périmètre

L'agent rend `/dashboard/find-jobs` et `/api/find-jobs/for-you` compatibles avec le runtime LangGraph (6 nœuds). Le parcours existant conserve le choix d'un CV éditable, les préférences de recherche, les offres sauvegardées, l'ouverture des détails et l'action **Préparer une candidature** (sans envoi automatique).

```text
context → discover → filter → rank → match → assemble
```

- `agent/` : état, orchestration et contrat d'entrée ; run authentifié, sans checkpoint de données CV.
- `nodes/` : six transformations isolées, supervisées par les budgets et événements existants.
- `tools/` : profil métier issu du CV, catalogue existant, filtres stricts, sélection heuristique, délégation au **Job Match Agent de l'étape 10**.
- `prompts/` : politique de provenance et d'interdiction des données inventées ; pas de nouveau LLM de découverte.

## Réalité et pertinence des offres

1. Le catalogue vient **exclusivement** des connecteurs déjà configurés (`getJobsPool`) et des `ExternalJob` actifs. Aucun job de démonstration ou lien inventé n'est inséré.
2. Les résultats doivent avoir un intitulé, une entreprise, une description et des liens sources/candidature HTTPS valides. Les URLs dupliquées sont écartées. **Cela n'est pas une garantie que l'annonce est toujours ouverte** : l'état de l'offre dépend du fournisseur.
3. Les contraintes de pays, ancienneté de publication, contrat, séniorité, lieu de travail, salaire annuel USD et parrainage de visa sont strictes ; les valeurs inconnues ne franchissent pas les filtres stricts.
4. L'intitulé recherché est une **intention de métier** (une recherche sur « Frontend Developer » ne requiert pas la phrase identique) ; `rankJobs` réutilise les compétences et expériences du CV pour sélectionner les cinq meilleures offres pertinentes. Une annonce incohérente n'est pas récupérée pour remplir artificiellement cinq places.
5. Le score heuristique de présélection **n'est jamais présenté** comme un score d'adéquation. Au maximum **trois** annonces parmi les cinq font une analyse approfondie via `runJobMatchAgent` (extraction ancrée dans le texte source, comparaison et score déterministe). Les autres affichent explicitement « non évalué ».
6. L'analyse approfondie utilise un profil technique vide (aucune compétence) et **uniquement le CV sélectionné** comme preuve, conformément à l'interface existante. L'email de schéma technique n'est ni un profil utilisateur ni une preuve de qualification.
7. L'indisponibilité du modèle, des quotas ou d'une annonce laisse les vraies offres consultables avec un score `null`, sans fausse note de compatibilité.

## Sécurité et coût

- `getSessionUser()` avant toute requête, CV recherché avec `conversation.userId = actor.id`, et choix de CV validé sur le serveur.
- Préférences enregistrées avec `where: { userId: actor.id }`. Aucun ID utilisateur provenant du client n'est accepté.
- Quota `JOB_ANALYSIS` réservé une fois pour un ensemble d'analyses ; aucune consommation si aucune annonce pertinente ne justifie l'appel IA.
- Délégation read-only : aucune candidature, aucun paiement, aucune modification de CV depuis le graphe.
- Timeout global 55 secondes, annulation propagée et résultat non persisté dans les checkpoints LangGraph.
- Cache privé par empreinte SHA-256 (utilisateur, CV/révision, préférences et texte des annonces), durée maximale 10 minutes. Les erreurs IA ne sont pas mises en cache.

## Commandes

```bash
npm run test:agentic:stage11
npm run test:agentic:stage11:integration
npm run typecheck
npm run build
```

`integration`, `typecheck` et `build` nécessitent `npm install`, `prisma generate`, et une configuration DB/IA valide pour les parcours réels. Ne pas considérer un test structurel comme un test de bout en bout.
