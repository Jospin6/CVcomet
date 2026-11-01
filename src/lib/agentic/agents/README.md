# Organisation des agents CVComet

Chaque agent possède **quatre dossiers différents** :

```text
agents/<agent-id>/
  agent/    # graph.ts, state.ts, entrypoint, composition du workflow
  nodes/    # opérations atomiques et décisions de routage
  tools/    # adaptateurs aux services métier existants, permissions, schémas
  prompts/  # prompts versionnés et instruction de sortie
```

`agents/demo` contient le seul graphe exécutable introduit à l'étape 02 ; les autres dossiers sont réservés pour la migration métier correspondante. Les fichiers `.gitkeep` ne sont **pas** des agents implémentés. Ne brancher aucun agent métier sur une API avant son étape et ses tests.

Les modules communs vivent dans `../core/`. Aucun prompt, schéma de CV, règle ATS, accès à Neon/Prisma, clé fournisseur ou choix de modèle particulier ne doit y être incorporé. Chaque outil spécialisé doit réutiliser les règles de propriété, quotas et validation déjà présentes dans le projet.

Ne stocker aucune donnée personnelle dans les événements de progression. Les checkpoints persistants sont réservés à l'étape 03 et les approbations durables à l'étape 04.
