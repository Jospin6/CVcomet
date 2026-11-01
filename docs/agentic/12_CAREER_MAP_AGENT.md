# Étape 12/20 — Career Map Agent (LangGraph)

## Objectif et limites

Migration de la génération de carte de carrière existante (`/dashboard/career-map` et `POST /api/career-map`) vers un **graphe LangGraph éphémère en six nœuds**, sans remplacer la carte interactive ni ses préférences. Le résultat reste stocké dans `CareerMap.graph` et `CareerMap.profile` sous le contrat préexistant (rôles, nœuds, arêtes, pourcentage d'overlap et micro-plan).

Le moteur utilise un **référentiel de 20 métiers explicitement documentés dans le code**. Les recommandations sont exploratoires, pas des offres d'emploi, probabilités d'embauche, revenus anticipés ni garanties de compétences. Il ne réalise volontairement **aucun appel LLM** dans cette étape : les règles métier restent déterministes et auditables. L'architecture `prompts/` documente la politique de vérifiabilité pour de futures extensions, sans prétendre qu'un modèle l'exécute déjà.

## Orchestration

```text
context → evidence → rank → roadmap → verify → assemble
```

- `agent/` : état typé, graphe, contrôle d'identité et budget d'exécution (12 s, limite de récursion 14).
- `nodes/` : snapshot, extraction de sources, classement, construction des chemins, validation des invariants, assemblage.
- `tools/` : catalogue connu, préférences Zod, recherche d'expressions complètes, sources de preuves, classement et micro-plans.
- `prompts/` : charte de fidélité des données, interdiction de faire passer un projet de carrière pour une compétence prouvée.

Le graphe ne lit pas la base et n'écrit aucun objectif ou CV. Il n'a **pas de checkpointer** pour le contenu du profil ou du CV. Le service (`src/lib/career-map/service.ts`) charge les seules données autorisées et enregistre le résultat après validation du graphe.

## Données et interprétation

1. Authentification dans les routes; CV chargé uniquement avec `conversation.userId = actor.id`. L'identifiant client n'autorise pas une lecture transverse.
2. Sources de compétences autorisées : `profile.skills`, descriptions d'expériences, descriptions de projets, certifications; et les champs correspondants du CV **sélectionné et autorisé**.
3. Le titre, le résumé de positionnement, l'intitulé cible, l'industrie désirée et les intérêts n'ajoutent **aucune compétence acquise**. Les objectifs de carrière servent seulement à pondérer l'ordre des rôles. Le mode de travail, l'équilibre et le niveau de revenus sont conservés sans fabrication de salaire.
4. Détection par expressions entières avec quelques alias vérifiés (`Node.js`, `AWS`, etc.), évitement des mentions explicitement négatives et bornes sur la lecture de champs JSON du CV. La provenance est visible dans la fiche métier.
5. `compatibility` est **strictement** `round(nombre de compétences mentionnées / taille du catalogue pour ce rôle × 100)`; aucune décision LLM ou prévision statistique.
6. Les arêtes relient `profile` à chaque rôle sélectionné. Les étapes du plan proviennent uniquement des compétences absentes du référentiel, sans modification de CV ni candidature automatique.

## Objectifs

`POST /api/career-map/goals` conserve l'action manuelle « Set as career goal » :

- Si `mapId` est fourni, la carte doit appartenir à l'utilisateur et `roleId` doit appartenir aux nœuds de cette carte.
- Le plan enregistré est celui de la carte, filtré par les compétences du catalogue connu; pas un plan fictif distinct.
- Les identifiants de progression soumis sont vérifiés et uniques.
- Si `completedStepIds` est omis lors d'une sauvegarde répétée, la progression existante **n'est pas effacée**.
- Sans `mapId`, le comportement historique d'un objectif indépendant reste disponible.

## Contrats conservés

- `GET /api/career-map` renvoie `maps`, `goals`; `DELETE /api/career-map/[id]` supprime une carte détenue par l'utilisateur.
- `POST /api/career-map` conserve `{ cvId?, preferences? }` et les limites préexistantes de création (5 cartes / heure / utilisateur).
- `CareerMap.graph.nodes[*]`: `id`, `title`, `compatibility`, `acquired`, `missing`, `explanation`, `plan`. Ajout rétrocompatible facultatif `evidence` et métadonnées du graphe `version`, `disclaimer`.
- L'écran Career Map existant reste interactif, thème inclus, et affiche les sources si disponibles. Les cartes antérieures sans `evidence` restent lisibles.
- Pas de migration Prisma ni de variable secrète supplémentaire.

## Commandes de validation

```bash
npm run test:agentic:stage12
npm run test:agentic:stage12:integration
npm run test:agentic:stage10
npm run test:agentic:stage11
npm run typecheck
npm run build
```

Les tests d'intégration **avec le vrai LangGraph**, `typecheck` et `build` exigent d'avoir installé les dépendances de l'application (`npm install`, `prisma generate`) et, pour les parcours DB, un environnement de recette adapté. Les tests unitaires et le graphe simulé ne constituent pas une recette de production.

## Restrictions connues

Le catalogue de rôles est actuellement surtout orienté métiers numériques. L'étape 12 ne l'élargit pas à tous les secteurs; une enrichissement devra s'appuyer sur un référentiel vérifié, pas sur des intitulés ou salaires imaginés. Une mention de compétence dans un document n'est **pas** une validation indépendante de sa maîtrise. Aucun appel à des annonces externes n'a été ajouté ici; la découverte d'offres réelles reste la responsabilité de l'étape 11.
