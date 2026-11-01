# Étape 13 — Vérification et recette

## Résultats locaux constatés

| Test | Résultat |
|---|---|
| `npm run test:agentic:stage13` | **14 / 14 réussis** (tests d'outils, graphe simulé et frontière agent) |
| `npm run test:agentic:stage10` | **10 / 10 réussis** |
| `npm run test:agentic:stage11` | **11 / 11 réussis** |
| `npm run test:agentic:stage12` | **13 / 13 réussis** |
| Tests historiques `interview-coach-phase10` + `interview-coach-boundaries-phase10` avec `--experimental-strip-types` | **12 / 12 réussis** |
| `npm run test:agentic:stage13:integration` | **Non validé** : les quatre tests échouent à importer LangGraph faute de modules npm installés |
| `tsc --noEmit` | **Non validé** : les dépendances npm et le client Prisma sont absents; nombreuses erreurs de résolution, aucune conclusion de build possible |
| `npm run build` | **Non exécuté** : dépendances et environnement complets absents |

## Scénarios couverts par les tests locaux

1. Validation de l'identité serveur, des langues acceptées, du nombre de questions et des bornes du contexte.
2. Graphe de préparation : exécution des quatre nœuds, génération ponctuelle, déduplication et fallback sur panne de fournisseur.
3. Préparation : quota `429` explicitement propagé; conversion des fausses expériences proposées en conseils.
4. Graphe d'évaluation : mêmes quatre nœuds, note calculée uniquement par la grille 35/25/20/20, extraits de réponse vérifiés.
5. Évaluation indisponible : `score:null`, aucun score basé sur la taille de la réponse.
6. Régressions : identité, propriété CV/candidature, compare-and-swap de la progression, sessions persistantes, bilans fondés sur les notes existantes.

## Recette intégration à effectuer dans le projet déployable

1. Restaurer la base `cvcomet(3).zip`, puis appliquer le ZIP cumulatif de l'étape 13 à la même racine de projet, sans écraser les variables d'environnement.
2. Installer les dépendances (`npm install`) et générer Prisma (`npx prisma generate`) dans l'environnement de test.
3. Exécuter les commandes ci-dessus puis tester un compte authentifié et deux comptes distincts : un CV ou une candidature d'un autre compte doit être refusé avant le modèle.
4. Tester les modes Basic et Personalized sur `dashboard/interviews`, en français et en anglais, avec démarrage, réponse, historique, fin anticipée et suppression.
5. Vérifier qu'une session reçoit exactement une réponse par index, que deux soumissions concurrentes ne font pas avancer la même question deux fois, et qu'un `409` n'ajoute aucun message.
6. Simuler les limites de quota, une erreur de fournisseur, un délai dépassé et une annulation. Un échec d'évaluation ne doit pas attribuer de note.
7. Vérifier que la transcription textuelle et les routes de screening LiveKit existantes restent inchangées. Aucune donnée personnelle ne doit être journalisée par l'orchestrateur.
8. Vérifier le build Next.js et les interactions utilisateur en navigateur avant qualification pour la production.

**Statut :** code de l'étape 13 et tests locaux terminés; intégration LangGraph native, base de données, fournisseur IA et build complet **à valider**, sans commencer l'étape 14.
