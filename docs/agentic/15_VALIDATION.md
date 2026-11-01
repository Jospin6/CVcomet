# Étape 15 — critères d'acceptation et commandes

## Livré

- [x] Ajout d'un véritable `StateGraph` LangGraph pour le brouillon initial.
- [x] Ajout d'un véritable `StateGraph` LangGraph pour la suggestion d'email.
- [x] Intégration du premier dans `createApplicationPacket`, du second dans l'API `suggest-email`.
- [x] Nœuds, prompts, outils et entrypoint séparés.
- [x] Réutilisation de `draftApplicationEmail`, `assertDocumentFacts`, quotas et ownership existants.
- [x] Révision du paquet et des sources revérifiées après le passage au modèle.
- [x] Aucune modification automatique du CV, de la lettre ou du dossier après simple suggestion.
- [x] Aucune nouvelle route d'envoi, aucun email envoyé et aucune candidature soumise.
- [x] UI existante compatible avec la forme de la réponse.

## Régression exécutée localement

| Commande | Résultat |
|---|---|
| `npm run test:agentic:stage15` | **12/12** |
| `npm run test:agentic:stage10` | **10/10** |
| `npm run test:agentic:stage11` | **11/11** |
| `npm run test:agentic:stage12` | **13/13** |
| `npm run test:agentic:stage13` | **14/14** |
| `npm run test:agentic:stage14` | **16/16** |
| `npm run test:phase09` | **12/12** |
| `npm run test:cvcomet:baseline` | **190/190** |
| `node --experimental-strip-types --test scripts/interviews-screening-2026.test.mjs` | **8/8** |
| `npm run check:syntax` | **628 fichiers, 0 erreur de syntaxe** |
| `npm run test:agentic:stage15:integration` | **À exécuter après npm install** |
| `npm run typecheck` / `npm run build` | **À exécuter après npm install et prisma generate** |

**Important** : les tests des graphes simulés vérifient l'orchestration, mais ne remplacent pas un test runtime avec les vrais paquets npm et la base Neon. Ne pas annoncer une validation production avant les tests d'intégration et une recette utilisateur de l'écran Application Agent.

## Périmètre de la prochaine étape

L'étape 16 annoncée dans l'audit est **Career Assistant Supervisor**. Elle est hors périmètre de cette livraison : aucun routage multi-agent du Career Assistant n'est activé ici.
