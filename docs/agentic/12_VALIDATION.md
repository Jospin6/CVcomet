# Étape 12 — Vérification et recette

## Exécuté localement

- `npm run test:agentic:stage12` : **13 / 13 réussis**. Tests du catalogue, extraction de preuves, intitulés de postes non utilisés comme compétences, négations et frontières de mots, sources du CV, score déterministe, anti-tampering, six nœuds réels exécutés avec un orchestrateur simulé, contrôle de propriété du CV, objectifs autorisés et conservation de la progression.
- Dans le projet reconstitué (base complète `cvcomet(3).zip` + fichiers cumulés étapes 1–12) : `npm run test:agentic:stage10` **10 / 10 réussis**, `npm run test:agentic:stage11` **11 / 11 réussis**.
- Les nouveaux fichiers TypeScript / TSX ont été transpillés sans erreur de syntaxe.

## Non validé dans cet environnement

- `npm run test:agentic:stage12:integration` : échoue avant d'exécuter les graphes réels car `@langchain/langgraph`, `zod` et les dépendances npm ne sont pas installés dans le répertoire de travail. Ce sont des tests volontairement non-sautés; les réexécuter dans le projet après `npm install`.
- `npm run typecheck` et `npm run build` : non exécutés ici, faute de dépendances installées / Prisma généré. **Aucune affirmation de build vert ou de test de production.**

## Recette manuelle après installation

1. Se connecter avec un profil contenant des compétences et créer une carte sans CV, puis avec un CV détenu par le compte.
2. Comparer la compatibilité et la provenance des compétences dans la fiche métier; confirmer que les rôles souhaités n'ajoutent aucune compétence.
3. Contrôler les anciennes cartes et la sauvegarde d'un objectif sur chacune, puis la conservation des étapes déjà complétées.
4. Vérifier le rejet d'un CV appartenant à un autre utilisateur et le rejet d'un `mapId` d'un autre compte.
5. Contrôler les limites de création, l'annulation d'une requête, le chargement thème clair/sombre et l'absence de modification automatique du CV.
6. Vérifier `npm run typecheck`, `npm run build` et les tests d'intégration réels avant déploiement.

**Décision :** implémentation et tests locaux terminés; validation native / recette applicative encore nécessaire avant qualification production. Ne pas commencer l'étape 13 avant validation de cette étape.
