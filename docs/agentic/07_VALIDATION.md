# Recette — Étape 07 : Resume Agent

**Ne pas passer à l'étape 08 tant que les tests d'intégration et de build n'ont pas été exécutés avec succès.**

## Tests sans fournisseurs ni base de données

```powershell
npm run test:agentic:stage07
npm run test:cvcomet:baseline
npm run check:syntax
```

## Tests obligatoires avec les vrais packages (sans crédit IA)

```powershell
npm install
npx prisma generate
npm run test:agentic:stage07:integration
npm run typecheck
npm run build
```

Le test `stage07:integration` utilise les vrais `StateGraph`, mais des fonctions de génération/quota simulées : aucun document réel et aucun appel OpenAI/Gemini/Claude. Il doit échouer si LangGraph n'est pas installé, pas être ignoré.

## Recette UI + API sur environnement de développement

1. Ouvrir un CV du compte. Dans **Open tools → AI Assistant → Chat**, demander une reformulation de la synthèse ; vérifier que le serveur ne change pas le CV avant validation.
2. Vérifier le panneau de proposition **avant/après** ; refuser et confirmer que le document reste intact ; renouveler puis accepter et vérifier l'incrément de révision et l'historique.
3. Basculer sur **Selected text**, choisir `summary.0` et demander une reformulation ; même si le modèle propose aussi un changement de design ou de titre, aucun autre champ ne doit être modifié.
4. Modifier le CV dans un autre onglet entre proposition et approbation ; l'approbation d'une proposition basée sur une ancienne révision doit être refusée (`409`).
5. Demander d'ajouter « 900 projets livrés » sans source explicite ; aucune affirmation chiffrée inventée ne doit être insérée.
6. Demander d'adapter le CV à une offre alors qu'aucune n'est liée ; l'agent doit demander le contexte sans consommer de quota.
7. Ajouter une offre liée appartenant au même compte ; demander une adaptation et contrôler que les exigences du poste ne deviennent jamais des compétences fictives du candidat.
8. Ouvrir une candidature possédant un CV ; demander une amélioration : la proposition doit toujours être soumise à la validation existante.
9. Tester `/api/resume-ai` en mode `GENERATE` et `SHORTEN` avec des faits réels ; vérifier que la réponse reste `{ proposal: string }` et ne modifie aucun document.
10. Tester annulation, expiration du quota, absence de modèle actif, demande trop longue, CV non autorisé et retour au chat après un refus.

## Ce qui n'a pas été touché

UI de l'éditeur, galerie Layout, prévisualisation, templates, export PDF/DOCX, panneau ATS, calcul ATS, langues, lettres et schéma Prisma.
