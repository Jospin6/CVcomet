# CVComet Career Assistant — Code à intégrer

## Fichiers de cette livraison

- `src/app/dashboard/assistant/page.tsx` — interface conversationnelle plus compacte, raccourcis de contexte, brouillons soumis à approbation dans la conversation, ancienne référence à Evidence Vault retirée.
- `src/lib/career-os/agent-engine.ts` — lecture déterministe de la candidature sélectionnée, toujours comptée dans la limite de trois outils.
- `src/lib/career-os/agent-service.ts` — branchement de la lecture contextuelle vérifiée avant de rédiger la réponse IA.
- `scripts/career-assistant-context.test.mjs` — tests de politique et de contexte.

## Utilisation

Ouvrir `/dashboard/assistant` pour discuter ou créer une mission persistante.

Ouvrir `/dashboard/assistant?applicationId=<UUID>` depuis un dossier de candidature pour que l'agent récupère automatiquement ce dossier **uniquement si l'utilisateur authentifié en est propriétaire**. La page offre alors l'accès à la comparaison d'offre, aux entretiens et à la préparation du dossier.

Les propositions de modification utilisent les API déjà présentes dans CVComet :

- `POST /api/career/v1/agent/drafts`
- `POST /api/career/v1/agent/drafts/decision`

Une proposition n'est appliquée qu'après validation par l'utilisateur. Les envois d'emails et les candidatures externes ne sont pas activés.

## Installation

Copier les fichiers à la racine du dépôt existant en respectant l'arborescence. Aucune migration Prisma ni nouvelle dépendance pour ces changements.

```bash
node --experimental-strip-types --test scripts/career-assistant-context.test.mjs
npm run test:phase06
npm run test:phase07
npm run typecheck
npm run dev
```

## Limites

Ce correctif **n'implémente pas** un orchestrateur autonome complet de tous les services CVComet : l'analyse, le CV, la lettre et l'entretien sont reliés par les parcours existants ; ils ne sont pas encore exécutés automatiquement en chaîne depuis une seule phrase. Les propositions documentaires restent des actions explicitement préparées et approuvées.

Les tests de base et de syntaxe ont été exécutés. Le typecheck complet et les tests avec une base Neon et un fournisseur IA réels doivent être réalisés dans l'environnement de déploiement.
