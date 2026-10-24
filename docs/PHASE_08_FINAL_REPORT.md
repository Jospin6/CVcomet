# CVComet 2.0 — Étape 08/14 : ATS & Job Intelligence 2.0

**24 octobre 2026 — Développement local livré ; mise en production NON certifiée.**

## Objectif et portée

Renforcer la comparaison d'un profil/CV à une offre réelle avec des recommandations sourcées, classées et explicables. Un score CVComet **n'est ni un score ATS officiel, ni une estimation de probabilité d'embauche, ni une validation légale d'éligibilité**.

## Implémentation

1. **Diagnostic Job Intelligence v2** (`src/lib/career/job-intelligence.ts`) : construction déterministe à partir des exigences extraites et des états calculés par le moteur existant ; couverture des critères examinables, répartition documenté/partiel/sans preuve/à vérifier, recommandations classées d'abord par niveau REQUIRED/PREFERRED/MENTIONED puis par besoin de vérification. Au plus 12 actions, preuves bornées, notes de confiance méthodologique et avertissements traduits FR/EN.
2. **Compatibilité ascendante** (`job-schema.ts`, `job-match.ts`) : les correspondances historiques restent au format `version: 1`, avec champ JSON **optionnel** `intelligence` pour les nouveaux calculs. **Le barème précédent et les poids du score n'ont pas été modifiés**, pour éviter des résultats non comparables sur les historiques. Aucune prétendue norme ATS externe n'est introduite.
3. **Nouvelle interface** (`job-intelligence-panel.tsx`, tableau de bord job-match) : diagnostic lisible avant la liste des exigences, classement des actions, citations exactes de l'offre et références au profil/CV ; la langue suit l'interface. Le panneau calcule ses recommandations aussi pour les anciennes analyses, qui ne contiennent pas encore `intelligence` dans le JSON.
4. **Outil Career Agent en lecture seule** : `get_my_job_match_insights {matchId: uuid}` ; identification exclusivement depuis la session serveur, requête `where: {id: matchId, userId: actor.id}`. Exige une analyse et un snapshot valides ; renvoie uniquement score indicatif, qualité de couverture, compteurs et cinq actions au maximum, **sans le CV complet ni le texte complet de l'offre**. Si l'ID n'existe pas ou appartient à autrui, retourne `RESOURCE_NOT_FOUND` ; aucune possibilité de fournir un `userId` dans les arguments. L'agent doit utiliser un ID connu et ne pas le deviner.
5. **Sécurité des sorties** : données de source toujours traitées comme texte non fiable, sans injection HTML. Les actions externes restent désactivées ; la création des documents exige toujours les validations et approbations déjà mises en place dans les étapes précédentes.

## Principales limites explicites

- La présence d'un terme dans un CV ou profil **ne prouve pas le niveau réel** d'une compétence. Même une confirmation dans Evidence Vault reste déclarative. Les conseils invitent à présenter uniquement des projets et réalisations véridiques.
- Cette étape apporte un **diagnostic explicable** et non un nouveau classificateur sémantique calibré par des recruteurs. Les extractions LLM dépendent toujours du fournisseur configuré et de la qualité du texte de l'offre.
- Aucun scrapping complémentaire, aucune promesse de disponibilité d'emploi en temps réel, aucun envoi de candidature.
- Pas de nouveau schéma Prisma ni de migration : les champs JSON existants enregistrent les nouveaux diagnostics.
- Aucune connexion PostgreSQL, Better Auth, LLM réel ni build Next.js complet : **à valider sur un environnement de staging**. L'absence de `node_modules` empêche le typecheck sémantique et les suites de tests d'intégration nécessitant Next, Prisma et Zod.

## Validation locale effectivement exécutée

- `npm run test:phase08` : **10/10** tests nouveaux réussis (règles pures, ordre des actions, données manquantes, FR/EN, limites, snapshots invalides, vérifications statiques d'intégration et de propriété).
- Tests historiques exécutables sans dépendances de l'application : `career-os-contracts`, `career-agent-engine`, `career-mission-policy` + nouveaux tests : **35/35** réussis.
- Transpilation syntaxique via TypeScript global : **363 fichiers TS/TSX** analysés, **0 erreur syntaxique**. Cela **ne vaut pas** un `tsc --noEmit` complet.
- ZIP cumulatif reconstruit depuis la source d'origine, vérifié par `ZipFile.testzip`, chemins des 161 fichiers de l'étape 07 conservés, empreintes SHA-256 et manifeste.

## Recette staging avant mise en production

1. Sauvegarder la base, installer les fichiers ZIP à la racine du projet source, puis `npm ci` **si un lockfile fiable est disponible** (sinon établir un lockfile sous contrôle de version avant déploiement).
2. `npx prisma validate`, `npx prisma migrate deploy`, `npx prisma generate`.
3. `npm run test:cvcomet:baseline`, `npm run test:job-analyzer`, `npm run typecheck`, `npm run build`.
4. Avec deux comptes : essayer de demander à l'agent l'ID d'une analyse du second compte ; vérifier 404 et absence de fuite.
5. Comparer un CV documenté, un CV vide, une exigence ambiguë, un diplôme chiffré et une condition légale. Vérifier les citations et l'absence de fausses affirmations.
6. Recharger une ancienne analyse enregistrée (sans diagnostic v2), puis une nouvelle ; vérifier les actions FR/EN, la lisibilité mobile et les propositions CV qui restent soumises à approbation.
7. Tester la révocation ou la suppression d'informations personnelles et vérifier les politiques de conservation des analyses historiques avant mise à disposition publique.

**Prochaine étape du plan : 09 — Application Agent (préparer les candidatures avec permissions et approbations, jamais d'envoi silencieux).**
