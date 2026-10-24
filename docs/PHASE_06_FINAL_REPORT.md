# CVComet 2.0 — Rapport étape 06/14 — Career Agent & Tool Calling

**Date :** 24 octobre 2026  
**Statut :** code local terminé, **production non certifiée**.  
**Livraison attendue :** archive cumulative des étapes 00 à 06, uniquement les fichiers créés/modifiés depuis le ZIP original, arborescence conservée.

## Modifications

- `src/lib/career-os/agent-engine.ts` : cœur déterministe, liste blanche, limite à trois lectures distinctes, arrêt sur erreur, annulation, délais, limitation de taille des résultats.
- `src/lib/career-os/agent-service.ts` : orchestration du modèle IA en deux invocations (plan structuré puis synthèse) ; outils existants exécutés avec l'identité de la session ; réservations quota avant chaque appel ; audit minimal des tokens et durées.
- `src/app/api/career/v1/agent/route.ts` : endpoint versionné, session et origine vérifiées, entrée stricte, sortie enveloppée et sans cache.
- `src/app/api/assistant/route.ts` : l'ancien endpoint est maintenant relié au nouveau Career Agent, en gardant la clé `message` pour compatibilité.
- `src/app/dashboard/assistant/page.tsx` : nouveau studio conversationnel clair, compte rendu des outils consultés, états d'attente et d'erreur, interface accessible.
- Tests : `scripts/career-agent-engine.test.mjs`, `scripts/career-agent-boundaries.test.mjs`.
- `package.json` : commandes de test étape 06 et baseline cumulative.
- Documentation : `docs/architecture/CAREER_AGENT_V1.md` et le présent rapport.

## Caractéristiques de sécurité

1. Acteur résolu **exclusivement côté serveur** ; outil authentifié et requêtes de base filtrées par propriétaire.
2. Aucun nom d'outil ou identifiant de compte externe accepté depuis la nouvelle API agent.
3. Plan IA vérifié contre les cinq outils de lecture et refus de toute action sensible. L'agent ne peut pas déclencher un achat, email, paiement ou modification de CV.
4. Pas de stockage silencieux de conversation ni données de carrière dans les logs applicatifs de l'agent.
5. Quotas facturés par appel modèle : deux réservations pour une réponse standard, chacune avant son appel ; usage enregistré séparément.
6. Sorties du modèle bornées, interruptions et budget de temps contrôlés ; réponse non vide obligatoire.
7. Les faits du coffre sont identifiés « confirmés par le propriétaire », pas « certifiés ».

## Résultats des vérifications

Les tests antérieurs doivent rester exécutables après l'intégration du ZIP. Aucun test utilisant une vraie base ou un véritable fournisseur IA n'a été effectué dans cet environnement ; ne pas assimiler les tests statiques à une validation de la production. Les résultats détaillés et les checksums figurent également dans le manifeste cumulatif.

## Installation et recette

1. Sauvegarder code et PostgreSQL ; extraire l'archive à la racine du dépôt CVComet original, sans supprimer les fichiers non présents dans le ZIP.
2. Appliquer les migrations cumulées précédentes si ce n'est pas déjà fait : `npx prisma migrate deploy` après sauvegarde et en staging d'abord.
3. Exécuter `npm install`, `npx prisma generate`, `npm run test:cvcomet:baseline`, `npm run typecheck`, `npm run build`.
4. Configurer le fournisseur IA et tester la route `/api/assistant` depuis une session valide ; vérifier les traces des cinq outils et les limites de quotas.
5. Simuler un utilisateur A tentant de lire le CV de B : échec sans fuite de données. Demander l'envoi d'une candidature : aucun effet externe.
6. Vérifier les cinq fournisseurs disponibles selon ceux réellement activés et leurs capacités de sorties JSON.

**Migration propre à l'étape 06 : aucune.** Les migrations de l'étape 00 à l'étape 04 doivent rester présentes dans le dépôt.

## Prochaine étape

Étape 07 — Mémoire, missions persistantes, états d'exécution, reprise et approbations durables.
