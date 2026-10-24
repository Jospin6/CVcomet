# CVComet 2.0 — Étape 07/14 : mémoire et missions persistantes

**24 octobre 2026 — Implémentation locale livrée, production non certifiée.**

## Objectif

Transformer le Career Agent en un copilote pouvant reprendre **des missions privées explicitement créées par l'utilisateur**, sans transformer toutes les conversations en historique permanent. Ne pas activer prématurément les emails, candidatures, paiements ou autres actions externes.

## Ce qui est implémenté

1. **Missions opt-in** : création (maximum 30), liste paginée, détail, renommage, archivage, réactivation, suppression définitive avec cascade des échanges et approbations. Toutes les requêtes vérifient l'utilisateur connecté et le périmètre propriétaire.
2. **Exécutions persistantes** : chaque demande sauvegardée reçoit un `requestKey` UUID ; une nouvelle demande crée un run `RUNNING`, puis `COMPLETED` ou `FAILED`. Le même UUID avec la même question renvoie une réponse déjà validée **sans rappeler l'IA**. Un UUID réutilisé pour un texte différent est rejeté.
3. **Concurrence et reprise** : verrou de mission par compare-and-swap transactionnel, `leaseToken` distinct à chaque tentative et bail de 90 s. Une reprise après expiration marque la tentative orpheline comme interrompue ; une requête avec la même clé peut être retentée. Les résultats obsolètes ne peuvent plus écraser la nouvelle tentative. Une interruption autour d'un appel fournisseur peut entraîner une nouvelle facturation à la relance : **pas de garantie d'exactement une invocation fournisseur**.
4. **Mémoire conversationnelle bornée** : au plus 6 échanges achevés, dans l'ordre chronologique, avec un plafond de 7 200 caractères. Les résultats bruts des outils et les exécutions échouées ne sont ni enregistrés dans le fil ni injectés dans le contexte historique. Les anciens échanges restent consultables par pagination.
5. **Approbations durables préparatoires** : une primitive serveur crée des demandes liées à l'acteur, la mission, l'action exacte et l'empreinte SHA-256 canonique de la charge ; expiration à 15 minutes, acceptation/refus explicites, consommation atomique unique. La décision d'approbation **n'exécute aucune action**. La création de telles demandes est volontairement réservée à des workflows serveur encore non branchés ; aucun endpoint public de fabrication d'approbation et aucun outil d'envoi ou de paiement activé à cette étape.
6. **Interface** : panneau des missions enregistrées et conversation temporaire ; gestion et pagination de l'historique ; messages d'erreur et récupération avec la même clé de requête ; décisions d'approbation si des demandes existent.

## API introduites

Tous les endpoints sont authentifiés ; les mutations imposent le contrôle d'origine, l'entrée JSON est strictement validée et limitée, les réponses sont encapsulées dans `{apiVersion,requestId,data}` et marquées `private, no-store` :

| Méthode | Endpoint | Objet |
|---|---|---|
| GET / POST | `/api/career/v1/missions` | Lister ou créer une mission opt-in |
| GET / PATCH / DELETE | `/api/career/v1/missions/:id` | Lire, renommer, archiver, restaurer, supprimer |
| GET / POST | `/api/career/v1/missions/:id/runs` | Paginer l'historique ou exécuter avec un `requestKey` UUID |
| PATCH | `/api/career/v1/missions/:id/approvals/:approvalId` | Enregistrer une décision `approve` / `reject` sans exécution |

Le précédent endpoint `/api/assistant` continue de fonctionner de manière non persistante. La route agentique versionnée de l'étape 06 reste compatible.

## Migration et fichiers

Nouvelle migration : `prisma/migrations/20261024230000_career_missions/migration.sql` ; nouveaux modèles : `CareerMission`, `CareerMissionRun`, `CareerMissionApproval`, avec suppression en cascade et statuts typés. Relation inverse ajoutée à `User`. L'étape modifie également `src/lib/career-os/agent-service.ts`, `src/app/dashboard/assistant/page.tsx` et `package.json`.

## Validation effectuée

- **124 tests ciblés réussis** : 25 (00), 14 (01), 12 (02), 14 (03), 19 (04), 13 (05), 15 (06), 12 (07).
- Vérification syntaxique sans erreur de **362 fichiers TS/TSX**.
- Tests de politiques pures (UUID, collision de clé, limites mémoire, chronologie, approbation expirée) et tests statiques de restrictions de route, CAS et schéma.
- Script staging optionnel : `npm run test:phase07:db` avec les variables de sécurité explicitement fournies ci-dessous.

**Non exécutés ici** : `prisma validate`, `prisma generate`, `tsc --noEmit`, build Next.js et essais avec de vrais PostgreSQL/fournisseurs IA. L'environnement ne dispose pas des dépendances du projet installées. La certification de production reste ouverte.

## Procédure de recette en staging

1. Sauvegarder le code et la base. Extraire le ZIP **à la racine du dépôt CVComet original** ; ne pas supprimer les fichiers non présents.
2. Sur une base **staging** à jour : `npm ci` si un lockfile existe dans votre dépôt, sinon `npm install`, puis `npx prisma validate`, `npx prisma migrate deploy`, `npx prisma generate`.
3. Vérifier `npm run test:cvcomet:baseline`, `npm run typecheck`, `npm run build`.
4. Optionnel, base PostgreSQL de test **jetable uniquement** (le script crée et efface des utilisateurs de test) : `ALLOW_MISSION_DB_TEST=1 CVCOMET_MISSION_TEST_DATABASE_URL="postgresql://..." npm run test:phase07:db`.
5. Recette session utilisateur A/B : B ne voit jamais les missions/runs/approbations de A, y compris par UUID transmis manuellement. Sans session : 401. Mutations cross-origin : refus.
6. Créer une mission, envoyer une demande, recharger, relire l'historique, reprendre après fermeture du navigateur. Envoyer deux fois la même clé : réponse identique, sans second appel fournisseur ; changer le texte pour cette clé : 409.
7. Tester la concurrence (deux requêtes de clés différentes), l'interruption réseau, le bail expiré et le retry de la même clé. Vérifier un éventuel double appel IA lors d'une reprise après incident, sans doublon de modifications externes (les outils sont en lecture seule).
8. Tester plus de 30 échanges, pagination ancienne, archivage, restauration, renommage, puis suppression définitive. Vérifier les cascades.
9. Vérifier que l'ancien chat temporaire ne crée pas de mission, que la mémoire injectée au modèle est bornée et que les outils restent en lecture seule.
10. Tester les approbations serveur en staging : consentement propriétaire, expiration, hash exact, refus, consommation unique ; vérifier qu'aucune approbation ne déclenche d'action externe.

## Limites / travaux futurs

- Pas de tâches en arrière-plan, de workers ni de notifications programmées à cette étape. Une mission reprend **lorsqu'un utilisateur revient et déclenche une demande**.
- La reprise du modèle est une **nouvelle invocation**, pas une reprise interne de l'état du fournisseur LLM. Le coût peut être répété si un crash survient après l'appel avant la persistance du résultat.
- Aucun workflow serveur ne propose encore d'approbation à l'utilisateur : le protocole est préparé, les actions nécessitant approbation restent désactivées.
- Les données sauvegardées relèvent des politiques d'hébergement et de sauvegarde PostgreSQL ; supprimer une mission efface ses lignes applicatives, sans promettre l'effacement instantané des sauvegardes externes.
- Les conversations temporaires peuvent toujours générer des métadonnées de quotas/usage IA mais ne créent pas d'historique CareerMission.

**Prochaine étape (08/14)** : ATS & Job Intelligence 2.0. Respecter la même livraison cumulative (union des fichiers modifiés depuis la phase 00, hiérarchie originale, exclusions inchangées).
