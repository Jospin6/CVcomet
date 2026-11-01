# Validation — Étape 10/20

Depuis le **projet source** `cvcomet(3).zip`, appliquer **l'archive cumulative étape 10** en préservant les chemins relatifs, puis :

```powershell
npm install
npx prisma generate
npm run test:agentic:stage10
npm run test:agentic:stage10:integration
npm run test:agentic:stage09
npm run test:agentic:stage09:integration
npm run test:job-analyzer
npm run typecheck
npm run build
```

Tests de recette fonctionnelle recommandés :

1. Analyse d'une offre longue contenant exigences requises, souhaitées et préférées, avec un CV appartenant au compte courant : vérifier les quatre onglets et les citations source.
2. Relancer la même offre pour vérifier cache et consommation de quota ; modifier le texte pour vérifier l'invalidation du cache et des citations.
3. Sans CV, vérifier l'état « sélection de CV » et l'absence d'invention de compétences.
4. Exigences ambiguës/nombres d'années/certifications : vérifier `VERIFY` sans déclaration d'acquis automatique.
5. Même offre/profil : le score demeure identique entre français et anglais ; seuls les textes d'accompagnement changent.
6. Vérifier `/dashboard/job-match?analysis=<id>` : reload restitue `resumePlan` sans rejouer le modèle.
7. Vérifier que le bouton de proposition d'adaptation **ne sauvegarde pas** le CV : seul le flux existant `ACCEPT` peut le faire.
8. Vérifier qu'un CV ou une candidature tiers ne peut pas être utilisé dans `POST /api/job-match`.
9. Vérifier les traces d'annulation et de délai, sans exposition de données personnelles.

Les tests `test:agentic:stage10` couvrent les garde-fous structurels et les outils réels sans IA. `test:agentic:stage10:integration` utilise **StateGraph réel** avec un extracteur simulé et doit échouer quand les packages requis manquent. Le build/les tests d'intégration ne sont **pas** considérés validés sans exécution sur le projet installé. Aucun test ne doit être ignoré silencieusement.
