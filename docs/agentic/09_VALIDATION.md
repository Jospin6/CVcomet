# Validation — Étape 09 ATS Agent

Depuis la racine du projet, après copie du ZIP cumulatif :

```powershell
npm install
npx prisma generate
npm run test:agentic:stage09
npm run test:agentic:stage09:integration
node --test scripts/ats.test.cjs
npm run typecheck
npm run build
```

Tester dans l'interface existante `/dashboard/ats` et `Open tools > ATS` :

1. Analyse sans offre ni PDF : seuls le contenu et ses constats évaluables apparaissent ; pas de score PDF ou job fictif.
2. Analyse avec une offre enregistrée appartenant à l'utilisateur : titre de l'offre conservé dans le rapport, éventuel réemploi de l'analyse validée, recommandations concrètes.
3. Analyse avec texte libre d'une offre : extraction et matching uniquement sur le contenu visible du CV.
4. Un CV ayant des sections masquées : aucun passage masqué ne sert d'élément de preuve.
5. PDF peu lisible : score technique du fichier réel ; pas de déduction de lisibilité depuis le nom du template.
6. Fournisseur IA indisponible : les vérifications déterministes restent visibles, `content.score` reste nul en l'absence de relecture sémantique, et aucune réussite fictive n'est affichée.
7. Un `jobId` d'un autre utilisateur : rejet sans accès au contenu ; pas de rapport enregistré.
8. Cache sur une même analyse, puis invalidation lorsque l'offre ou le CV change.
9. Les propositions de texte ne sont jamais appliquées automatiquement au CV.
10. Vérifier la langue FR/EN, les barres visuelles ATS existantes et l'absence de changement de layout.

### Interprétation des tests

Le test unitaire de l'étape 09 n'appelle ni IA ni Neon. Le test d'intégration **utilise réellement LangGraph** avec des adaptateurs simulés ; il doit échouer explicitement si les dépendances npm ne sont pas installées. Aucun test ne doit être déclaré réussi lorsqu'il a été ignoré.

### Portée

Les scripts des étapes 01–08, les autres agents et l'interface sont conservés. Aucune migration Prisma ni variable d'environnement supplémentaire n'est introduite.
