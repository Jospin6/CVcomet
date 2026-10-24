# CVComet 2.0 — Étape 13/14 : Qualité IA, conformité opérationnelle et observabilité

Date : 24 octobre 2026. Statut : code et tests ciblés locaux terminés ; **aucune certification de production**.

## 1. Livré

- **Observations persistantes des appels du Career Agent** : résultat `COMPLETED`/`FAILED`, phase (`PLAN`/`TOOLS`/`ANSWER`), durée en millisecondes, nombre d'outils lus, code d'erreur contrôlé et date. Aucun prompt, réponse, CV, payload d'outil, IP, email ou identifiant de fournisseur n'est enregistré dans ces événements.
- **Instrumentation fiable et non bloquante** : chaque appel autorisé au Career Agent tente de persister son état final, y compris après échec de planification ou du fournisseur. Une panne de télémétrie ne provoque pas à elle seule l'échec d'une réponse.
- **Garde-fou de sortie** : interdiction de quelques formulations non ambiguës qui affirment avoir envoyé une candidature ou contacté un recruteur. Ce garde-fou lexical est **limité**, ne permet pas de détecter toutes les hallucinations et ne remplace pas les validations documentaires ni humaines.
- **Feedback utilisateur sur les missions** : après une réponse complétée, le propriétaire peut choisir « Utile » ou « Peu utile », changer son avis ou l'effacer. Aucun commentaire libre n'est collecté ; aucune note n'est attribuée aux conversations temporaires.
- **Supervision administrateur** : `GET /api/admin/quality`, page `/admin/quality`, accès réservé au rôle administrateur : volume d'appels enregistrés, réussites/échecs, histogramme de codes d'erreur autorisés, p50/p95 sur un échantillon explicite et agrégat des évaluations volontaires.
- **Politique de rétention pour l'observabilité** : maintenance manuelle avec aperçu par défaut et purge explicite des événements techniques de plus de 30 jours. La suppression d'un compte supprime les événements associés par cascade. La suppression d'une mission supprime ses évaluations et messages (cascades existantes).
- **Batterie de tests synthétiques** : refus des faux envois, cas de négation, périmètre des outils, bornes des données, filtres de chiffres inventés des CV/lettres, contrôles d'API et rétention.

## 2. Fichiers principaux

- `src/lib/quality/agent-quality-policy.ts` : fonctions pures de sécurité, normalisation des métriques et calcul des percentiles.
- `src/lib/quality/agent-observations.ts` : journal des opérations et agrégats administrateur.
- `src/lib/quality/feedback-service.ts` : enregistrement d'avis strictement limité au propriétaire de la mission.
- `src/lib/career-os/agent-service.ts`, `src/lib/career-os/mission-service.ts` : instrumentation et données d'avis.
- `src/app/api/admin/quality/route.ts`, `src/app/admin/quality/page.tsx`, `src/app/admin/page.tsx` : supervision.
- `src/app/api/career/v1/missions/[id]/runs/[runId]/feedback/route.ts`, `src/app/dashboard/assistant/page.tsx` : avis utilisateur.
- `prisma/schema.prisma`, `prisma/migrations/20261025030000_career_quality/migration.sql` : modèle opérationnel et feedback.
- `scripts/cleanup-career-observations.cjs`, `scripts/career-quality-phase13.test.mjs`, `scripts/career-quality-boundaries-phase13.test.mjs` et `package.json`.
- `docs/quality/CAREER_AI_EVALUATION_AND_PRIVACY.md` : protocole, limites et recette.

## 3. API et confidentialité

### Feedback (authentifié, même origine)

`POST /api/career/v1/missions/{missionId}/runs/{runId}/feedback`

```json
{"apiVersion":"v1","rating":"HELPFUL"}
```

Choix `HELPFUL`, `NOT_HELPFUL` et `CLEAR`. Réponse via enveloppe API v1 contenant `runId` et le `rating` éventuellement `null`. Les IDs doivent appartenir au même compte, le run doit être `COMPLETED`. Corps strict limité à 512 octets. Aucune écriture pour un compte tiers et aucun commentaire libre.

### Supervision (administrateur)

`GET /api/admin/quality` : fenêtre glissante de 7 jours. Le p95 est calculé sur les **1000 dernières opérations complétées**, et le total d'opérations observées est distinct du total de tous les appels IA. Les évaluations restent auto-sélectionnées : elles ne mesurent pas la précision factuelle de manière représentative.

### Traitement des informations utilisateur

L'identifiant de compte est conservé **en base seulement** pour garantir la suppression par cascade et pour empêcher le mélange des comptes. Il n'est jamais renvoyé par la synthèse admin. Les données du CV et des conversations ne sont pas envoyées au système de monitoring. Les instructions de rétention demandent un véritable scheduling (cron externe) ; le simple ajout du script ne garantit **pas** la purge.

## 4. Vérification locale

- `npm run test:phase13` : 16 tests ciblés de cette étape.
- `npm run test:cvcomet:baseline` : exécution des suites ciblées des étapes 00 à 13 ; compter la totalité des tests à partir du journal de commande, pas du nombre de scripts.
- Analyse de la syntaxe TypeScript/TSX : analyse statique sans dépendances de runtime.
- Archive cumulative construite en comparant le dépôt de travail à `cvcomet.zip` et à la livraison 00-12. Vérification des empreintes SHA-256.

**Non exécuté** : installation complète des modules NPM, validation Prisma avec le moteur Prisma, `tsc --noEmit` sémantique, `next build`, migrations réelles, essais E2E browser, webhook Stripe, fournisseurs IA réels, tests de concurrence sur plusieurs instances, évaluation humaine d'un corpus de CV/lettres. Il ne faut pas considérer 16 tests de scénarios synthétiques comme preuve de qualité d'un modèle réel.

## 5. Installation / recette staging

1. Faire un backup cohérent de PostgreSQL ; extraire le ZIP cumulatif à la racine du dépôt original en conservant les chemins.
2. Installer les dépendances réelles, puis `npx prisma validate`, `npx prisma migrate deploy`, `npx prisma generate` ; ne pas appliquer directement sur la base de production sans recette.
3. Exécuter `npm run test:cvcomet:baseline`, `npm run typecheck` et `npm run build`.
4. Avec 2 comptes de test et 1 admin, vérifier qu'un utilisateur ne peut pas évaluer un run d'un autre compte, un run échoué ni une mission différente.
5. Répondre à une question avec un fournisseur actif ; contrôler le nombre d'observations, les erreurs après timeout et le fait que **le monitoring ne sauvegarde aucune donnée de candidature**.
6. Forcer une panne de la table de métriques en staging ; vérifier que cela n'entraîne pas une panne supplémentaire du chemin agentique.
7. Vérifier `/admin/quality` avec un admin, un utilisateur standard et un utilisateur déconnecté ; valider les percentiles et le périmètre des métriques.
8. Exécuter `npm run maintenance:career-quality` en mode aperçu, puis avec `-- --execute` pour la purge réelle. Programmer séparément une cadence quotidienne sûre via l'ordonnanceur de production et surveiller l'échec du job.
9. Tester la suppression du compte et de la mission, y compris la suppression des observations et feedbacks reliés. Vérifier les backups et leur propre politique de conservation.
10. Tester un ensemble multilingue de vraies requêtes (consenties, anonymisées, approuvées) et mesurer les erreurs de réponse avec une grille humaine dédiée (exactitude, provenance, utilité, sécurité, respect de la langue).

## 6. Limites / priorités résiduelles

- **Couverture** : instrumentation persistante centrée sur le Career Agent ; les générateurs CV, lettres, recherche d'offres et Interview Coach restent partiellement couverts par `AIUsage` et des tests métier, sans télémétrie normalisée équivalente. Ne pas présenter la page admin comme « la qualité de toutes les IA ».
- **Fiabilité des modèles** : seules certaines affirmations interdites sont bloquées. L'IA peut toujours commettre des erreurs factuelles non détectées par des regex. Aucune certification de non-hallucination n'est possible avec ces tests.
- **Conformité** : la résidence des données, base légale, consentement, protection des candidats, conservation des missions et backups, demandes d'accès/effacement, sous-traitants et transferts internationaux demandent une revue juridique pays par pays. Cette livraison n'accorde aucune conformité légale automatique.
- **Qualité des scores** : ni les scores ATS internes ni les avis « utile » ne sont des probabilités de recrutement.
- **Production** : vérifier en priorité l'absence de fuite de données entre utilisateurs, la migration, le typecheck et les parcours critiques avant le lancement de l'étape 14.
