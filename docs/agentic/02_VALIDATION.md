# Étape 02/20 — Critères de validation finale

Base unique : `cvcomet(3).zip`. Aucune modification du runtime métier, du schéma Prisma, de `package.json`, des interfaces, des clés ou des variables d'environnement. Le ZIP des étapes 01 + 02 n'inclut que les fichiers nouveaux ou modifiés depuis cette base.

## Tests exécutés dans l'environnement de préparation

| Test | Résultat |
| --- | --- |
| Audit de l'étape 01 et contrats du noyau étape 02 | 16/16 OK, aucun test ignoré |
| Tests historiques `npm run test:cvcomet:baseline` | 190/190 OK |
| Tests release phase 14 | 4/4 OK |
| `npm run check:syntax` | 446 TS/TSX analysés, 0 erreur de syntaxe |
| `tsc` strict appliqué aux fichiers `core/` | OK |
| Test d'intégration réel `StateGraph` | NON VALIDÉ : `@langchain/langgraph` absent de cet environnement et registre npm inaccessible (`EAI_AGAIN`) |
| `npm run typecheck`, `npm run build` | NON EXÉCUTÉS : dépendances npm absentes |

## Exécution impérative sur le projet où `node_modules` est installé

Depuis la racine `cvcomet/` après extraction de l'archive cumulative :

```powershell
node --experimental-strip-types --test scripts/agentic-stage01.test.cjs scripts/agentic-stage02.test.mjs
node --experimental-strip-types --test scripts/agentic-stage02-integration.test.mjs
npm run check:syntax
npm run typecheck
npm run build
```

La deuxième commande **doit réussir** : elle compile et exécute le vrai `StateGraph` en trois nœuds (`normalize` → `inspect` → `render`), appelle le registre d'outils, vérifie le résultat, la séquence d'événements, puis le rejet d'une entrée invalide. Si LangGraph n'est pas installé, elle **échoue** et indique de faire `npm install` ; aucun passage au vert artificiel via `skip`.

La réussite des tests contractuels seule ne certifie pas la compatibilité avec la version npm effectivement installée. En cas d'échec de typecheck ou d'intégration, corriger l'étape 02 avant de passer à l'étape 03.

## Critères de clôture

1. Tous les agents métiers disposent des dossiers `agent/`, `nodes/`, `tools/` et `prompts/`, sans logique métier simulée ni migration anticipée.
2. Runtime commun : validation d'identité, contrôle d'accès délégué aux outils, budget, annulation, récursion, erreurs sûres et événements techniques sans données privées.
3. Graph de démonstration exécuté **avec la vraie bibliothèque** (commande bloquante ci-dessus).
4. `npm run typecheck` et `npm run build` réussissent avec les dépendances du projet.
5. Aucune régression dans les tests de base.

**La livraison de code de l'étape 02 est terminée ; l'étape 02 ne sera déclarée pleinement validée qu'après réussite des contrôles 3 et 4 dans l'environnement de développement.** Aucune étape 03 n'est engagée.
