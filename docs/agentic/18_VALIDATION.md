# Étape 18 — validation locale et recette obligatoire

## Tests effectués dans l'environnement de livraison

- `npm run test:agentic:stage18` : **13/13 réussis**. Politiques d'événements, injection SSE, limites, isolation par propriétaire et tentative, écriture ordonnée, reprise, erreurs de stockage, liens entre superviseur et session, UI et contrats de mission.
- `npm run test:agentic:stage10` à `...:stage17` : **108/108 réussis**, avec deux assertions de présentation mises à jour pour tester le nouveau contrat de progression plutôt que l'ancienne UI statique.
- `npm run test:cvcomet:baseline` : **190/190 réussis**.
- `npm run check:syntax` : **660 fichiers TypeScript/TSX, 0 erreur de syntaxe**.

## Non validé ici

- `npm run test:agentic:stage18:integration` : dépendances `@langchain/langgraph`, client Prisma et runtime de l'application non installés; le test réel doit s'exécuter après `npm ci`.
- `npm run typecheck` : bloqué par modules et types React, Prisma, Next.js, Zod, LangGraph absents; la syntaxe seule n'est pas un typecheck.
- `npm run build`, migration Neon, appels LLM et tests manuels sur navigateur mobile/desktop : **non effectués**.

## Ordre de recette staging

```bash
npm ci
npx prisma migrate deploy
npx prisma generate
npm run test:agentic:stage18
npm run test:agentic:stage18:integration
npm run test:agentic:stage17
npm run test:agentic:stage16:integration
npm run test:cvcomet:baseline
npm run check:syntax
npm run typecheck
npm run build
```

Scénarios de recette : ouvrir une mission existante ; lancer une demande, regarder les étapes du graphe ; recharger au milieu et retrouver la mission par l'URL ; perdre/retrouver le SSE sans relancer le POST ; terminer la mission et relire la réponse validée ; simuler un tool qui échoue ; tester deux utilisateurs séparés et obtenir 404 sur une mission étrangère ; simuler des événements injectés ; vérifier que `approval.required` ne consomme aucune approbation ; fermer le navigateur au milieu de la demande et confirmer la gestion de l'interruption/lease ; réessayer avec la même clé ; s'assurer que les logs d'événements ne contiennent aucun document ni message privé.

**État :** implantation terminée et tests locaux réussis, mais pas validée en conditions de production avant cette recette et la migration staging.
