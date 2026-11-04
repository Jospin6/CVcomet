# CVComet — Consolidation i18next FR/EN

## Source de traduction

- `src/lib/i18n/i18n.ts` et `src/components/LanguageProvider.tsx` restent le système existant : `i18next` + `react-i18next`.
- `public/locales/{en,fr}/common.json` est la source unique des libellés migrés.
- `src/lib/i18n/central-copy.ts` est un adaptateur i18next pour les vues et exports qui nécessitent une langue explicite (pas un second catalogue de traductions).
- Le sélecteur de langue et les paramètres existants sont conservés.

## Migré dans cette livraison

- Libellés de `Applications`, formulaire de création de candidature, `Find Jobs`, `Jobs for You`, `Job Match`, `Edit CV`, `ATS Checker`.
- Page d'accueil, raccourcis outils et conseils, centre de commande de carrière, administration des fournisseurs IA.
- Principaux textes de l'assistant et de la mémoire, entretiens, affichage d'entretien vocal et progression des missions.
- Parcours import CV, lettre de démission et supervision des agents.
- Formulaires de connexion et inscription : erreurs de validation localisées.
- La création d'entretien basique utilise enfin la langue `en`/`fr` transmise par l'interface ; l'API n'enregistre pas `language` comme colonne de la session et conserve cette valeur dans `configuration`.
- La langue de création de documents reste indépendante de la langue d'interface lorsqu'elle est choisie explicitement.

## Contrôles

```bash
node scripts/check-central-i18n.cjs
npm run typecheck
npm run build
```

Le script contrôle la parité FR/EN, les paramètres d'interpolation et les dictionnaires migrés. Aucune dépendance nouvelle, aucun changement Prisma, et aucune modification des secrets.

## Limites restantes

Il s'agit d'une **consolidation importante mais pas d'une certification d'exhaustivité de l'ensemble de l'application**. Des textes anciens restent codés en dur dans certaines pages publiques, administrateur et API métier ; quelques erreurs renvoyées par les endpoints restent non localisées, et des libellés historiques sont encore gérés directement dans leurs composants. Les explications enregistrées dans les données utilisateur et les documents originaux ne sont jamais traduits automatiquement. Une recette navigateur bilingue et un audit des derniers textes visibles restent nécessaires avant d'affirmer une couverture totale.

L'ancienne route `/dashboard/ats` supprimée par les correctifs antérieurs **n'est pas réintroduite dans ce patch**.
