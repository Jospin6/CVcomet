# Étape 17 — compte rendu de validation locale

- 15/15 tests du nouvel agent réussis : politique de scope, taille, données non fiables, API propriétaire, révision optimiste, mission explicitement sélectionnée, graphe simulé, rendu UI.
- 93/93 tests des étapes 10–16 réussis (10 + 11 + 13 + 14 + 16 + 12 + 17).
- 190/190 tests de la suite de référence `test:cvcomet:baseline` réussis.
- Vérification de syntaxe TypeScript/TSX réussie. **La syntaxe ne garantit pas la conformité des types.**
- Test LangGraph réel : **non validé**. Les dépendances npm ne sont pas installées ; le gate d'intégration échoue volontairement.
- `npm run typecheck` : **non validé**, dépendances React/Zod/Prisma/LangGraph et types absents dans l'environnement de livraison.
- `npm run build`, migration et recette Neon/LLM : **non validés**. Aucun service externe n'a été sollicité.

Exécuter après `npm ci`, `npx prisma migrate deploy` et `npx prisma generate` :

```bash
npm run test:agentic:stage17
npm run test:agentic:stage17:integration
npm run test:agentic:stage16
npm run test:cvcomet:baseline
npm run check:syntax
npm run typecheck
npm run build
```

Tests manuels : enregistrer une préférence accessible au Supervisor uniquement ; vérifier qu'elle n'est pas lue par Resume ; autoriser Resume puis réessayer ; corriger/supprimer ; vérifier la révocation au tour suivant ; modifier dans deux onglets et vérifier HTTP 409 ; accéder à un `missionId` d'un autre compte (404) ; vérifier que les résultats ATS/Job Match ne considèrent jamais un objectif comme une compétence.

Les étapes suivantes ne sont pas incluses.
