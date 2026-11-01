# Recette étape 08 — à exécuter avant l'étape 09

## Prérequis

- Appliquer le ZIP **cumulatif 01–08** à la racine du projet actualisé `cvcomet(3).zip` (pas sur un ancien ZIP produit).
- Installer les dépendances définies dans le `package.json` de la livraison (`npm install` ou `npm ci` si le lockfile correspond).
- Exécuter `npx prisma generate` avant les tests d'intégration utilisant des types Prisma.
- Ne pas modifier les clés de production et ne pas tester sur une base contenant de vrais utilisateurs.

## Commandes

```bash
npm run test:agentic:stage08
npm run test:agentic:stage08:integration
npm run test:cvcomet:baseline
npm run test:phase14
npm run typecheck
npm run build
```

Le test d'intégration **n'est jamais ignoré** si le package `@langchain/langgraph` est absent : il échoue explicitement. Les unités testent le verrouillage des métadonnées, Selected text, les nombres non vérifiés, les outils, la structure, les modèles et les routes.

## Recette utilisateur manuelle

1. Créer une lettre depuis un véritable template : vérifier la prévisualisation et la persistance du style.
2. Dans Open tools / AI Assistant / Chat, demander une reformulation de la lettre. Vérifier l'affichage d'une proposition, son refus, puis son approbation.
3. Dans Selected text, sélectionner uniquement `body`. Demander une réécriture et vérifier que `introduction`, `conclusion`, design et contacts restent identiques.
4. Demander une nouvelle réussite chiffrée non présente dans le profil : l'agent doit demander de préciser les faits et ne doit pas créer de proposition.
5. Depuis une candidature existante, améliorer la lettre, approuver la proposition, vérifier la révision et l'historique.
6. Depuis une offre sauvegardée, générer une lettre : un brouillon est présenté avant SAVE ; confirmer que le nom de l'entreprise et les coordonnées du candidat proviennent du contexte autorisé, et non du modèle.
7. Refuser une proposition puis relancer l'acceptation : le backend doit la rejeter. Faire la même chose après une modification concurrente de la lettre.
8. Tester l'absence de crédit IA, une panne du modèle, une offre qui appartient à un autre compte et une lettre qui ne correspond pas à l'utilisateur connecté.
9. Vérifier que les CV, l'ATS, les exports et les lettres de démission fonctionnent sans changement d'interface.

## Conditions de validation

- Toutes les commandes ci-dessus réussissent sur le projet installé.
- Les trois parcours IA de lettres sont fonctionnels avec LangGraph, sans écriture automatique.
- Les corrections approuvées sont sauvegardées une seule fois et les informations non approuvées ne le sont jamais.
- Aucun problème de permissions, de fuites de coordonnées ou de régression de la mise en page.
- Aucune migration Prisma ni nouvelle clé d'environnement.

Tant que `test:agentic:stage08:integration`, `typecheck` et `build` ne sont pas exécutés avec succès sur une installation complète, la validation de production reste **en attente** même si tous les tests disponibles en environnement isolé passent.
