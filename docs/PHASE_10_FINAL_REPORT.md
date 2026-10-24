# CVComet 2.0 — Étape 10/14 — Interview Coach 2.0

Date : 24 octobre 2026. Livraison en développement local ; **pas de certification de production**.

## Objectifs et travaux effectués

1. **Évaluation de fond** : suppression du score artificiel fondé sur la longueur des réponses. Évaluation structurée par modèle IA sur quatre dimensions : pertinence (35 %), spécificité / exemples (25 %), structure (20 %), clarté (20 %). Chacune est notée de 0 à 4, puis ramenée sur 100, avec exercices et conseils concrets. Un score décrit seulement une appréciation pédagogique, jamais les chances d'embauche.
2. **Aucune note inventée** : si l'évaluation structurée est indisponible (erreur de modèle, quota, délai, etc.), la réponse est conservée, mais notée `null` avec `status: unavailable` ; aucun calcul par longueur ni score de remplacement.
3. **Feedback traçable** : tout extrait présenté comme preuve doit être réellement présent dans la réponse fournie. Les commentaires générés restent des interprétations du modèle et peuvent nécessiter une vérification humaine.
4. **Préparation réaliste** : scénarios multilingues diversifiés et contextualisation par rôle, offre d'emploi fournie, profil et faits du coffre professionnel **confirmés par le propriétaire**. Ces faits ne sont pas considérés comme vérifiés par des tiers. Les questions génériques de repli sont variées et ne prétendent pas provenir d'un recruteur.
5. **Correction du parcours** : auparavant, « Démarrer » créait une nouvelle session distincte et ignorait les questions préparées. Désormais `POST /api/interviews/{id}/start` active la **même session** de préparation avec les questions prévues et un contrôle de statut transactionnel.
6. **Concurrence** : lors d'une réponse, transaction `updateMany` avec contrôle de version logique (`status` et `currentQuestion`) ; une tentative obsolète ne peut pas ajouter une deuxième réponse à la même question. Le terminal du parcours passe à `READY_TO_FINISH`.
7. **Bilan explicite** : nombres de réponses évaluées et non évaluées, moyenne sur les seules réponses réellement notées, moyennes par dimension, forces, points d'amélioration et exercices. Historique des sessions et progression visuelle.
8. **Pratique vocale côté navigateur** : synthèse vocale des questions disponible via `speechSynthesis`; dictée sur action explicite du candidat via Web Speech API quand supportée. **Ce n'est pas un agent vocal temps réel.** Le navigateur peut transmettre l'audio à son fournisseur de reconnaissance. CVComet conserve le texte effectivement envoyé dans la session, sans conserver le flux audio.
9. **Compatibilité** : routes historiques maintenues (`GET/POST /api/interviews`, `POST /api/interviews/{id}/message`, `/finish`, `DELETE`). Les sessions historiques sont toujours affichées ; les bilans enregistrés avant la version 2 peuvent conserver leur ancien score, qui ne doit pas être présenté comme une évaluation v2.

## Changements principaux

- `src/lib/career/interview-coach-policy.ts` — politique pure, scénarios, calcul du score, preuve et bilans.
- `src/lib/career/interview.ts` — préparation, évaluation IA, exécution atomique, activation et bilan.
- `src/app/api/interviews/route.ts` — préparation et consultations maintenues, session directe modernisée.
- `src/app/api/interviews/[id]/start/route.ts` — activation de préparation existante.
- `src/app/api/interviews/[id]/message/route.ts` — validation stricte et délégation au service contrôlé.
- `src/app/dashboard/interviews/page.tsx` — parcours complet, feedback, micro en opt-in, synthèse vocale, progression et reprise.
- `scripts/interview-coach-phase10.test.mjs`, `scripts/interview-coach-boundaries-phase10.test.mjs` — 12 tests ciblés.
- `package.json` — scripts `test:phase10` et ajout dans le baseline.
- `docs/architecture/INTERVIEW_COACH_V2.md` — contrats et flux.

## Vérifications effectuées

- **158 tests ciblés** des étapes 00 à 10 exécutés avec succès avec `npm run test:cvcomet:baseline` (y compris 12 nouveaux tests étape 10).
- Analyse syntaxique : **373 fichiers TypeScript/TSX analysés, 0 erreur de syntaxe** (cela ne constitue pas un typecheck sémantique).
- Aucun changement de schéma Prisma. **Pas de migration requise** pour l'étape 10.

## Non validé ici

- Pas de `node_modules` installés, pas de base PostgreSQL de test connectée, pas de comptes Better Auth de test, pas de vraies clés de fournisseurs IA, donc **pas de typecheck sémantique, build complet ni test d'intégration de bout en bout**.
- Il faut vérifier en staging, notamment : migration préalable des étapes antérieures, création d'une préparation, démarrage conservant la session et son application, évaluation modèle avec quotas, comportement de deux requêtes concurrentes, sauvegarde du bilan, reprise sur un autre navigateur, compatibilité avec les anciennes sessions et fonctionnement de la dictée dans les navigateurs cibles.
- Les tests de frontière sont en partie statiques ; ils ne démontrent pas le fonctionnement de transactions PostgreSQL réelles.
- Ne pas commercialiser les scores comme mesure scientifique prédictive ni comme filtre de recrutement.

## Recette de staging recommandée

```bash
npm install
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npm run test:cvcomet:baseline
npm run typecheck
npm run build
```

Puis réaliser au minimum un entretien français et un anglais jusqu'au bilan, un test de quota épuisé (score `null`), un test de deux réponses simultanées, un test de suppression, et un test de dictée uniquement lorsque l'utilisateur l'active.

## Étape suivante

Étape 11/14 — Career Command Center : unification de l'expérience premium, navigation, états UX, cartes de missions et amélioration de l'accessibilité. Le ZIP doit être cumulatif (étapes 00 à 11), uniquement les fichiers modifiés avec leur arborescence d'origine.
