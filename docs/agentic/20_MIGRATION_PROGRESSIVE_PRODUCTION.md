# CVComet / LangGraph — Étape 20/20 : migration progressive et mise en production

## Périmètre réellement livré

L'étape 20 **ne remplace pas** l'application, ses API ni les UI candidates. Elle ajoute au **Career Assistant Supervisor** déjà branché depuis l'étape 16 :

1. Une sélection **côté serveur** entre `GRAPH` (LangGraph) et `LEGACY` (ancien planificateur/lecteur en lecture seule), en conservant `runCareerAgent` comme contrat public de `/api/assistant`, `/api/career/v1/agent` et du service de missions.
2. Un mode `rollout` en cohortes déterministes **par compte authentifié** (SHA-256, version figée), indépendantes des préférences du navigateur et du client HTTP. La sélection est réalisée une seule fois au début de la requête.
3. Un **kill switch** de retour arrière. Aucun nouvel appel IA de secours n'est relancé si le graphe choisi a échoué : cela éviterait une seconde réservation de quota, une double facturation et une réponse divergente après une requête déjà engagée.
4. Une instrumentation limitée au champ `engine` sur `CareerAgentObservation`, avec anciennes observations `UNKNOWN` et agrégation anonymisée des résultats opérationnels.
5. Un endpoint d'administration en lecture seule `/api/admin/agentic/rollout`, protégé par le rôle administrateur **avant** la lecture de données. Il compare les comptes d'exécution et un p95 échantillonné des deux moteurs, sans noms de candidats, prompts, CV, réponses ou résultats bruts.
6. Un tableau comparatif compact dans l'administration existante `/admin/agentic-quality`, sans UI de changement des flags.
7. Des tests locaux de sécurité/rollout, un test distinct de **véritable runtime LangGraph**, la matrice des étapes 1–20 et un preflight de release qui ne déclare pas artificiellement une certification de production.

**Limite stricte :** le fallback `LEGACY` concerne uniquement le Career Assistant. Les parcours ATS, CV, Cover Letter, Job Match, Job Discovery, Career Map, Interview Text, Interview Voice et Application restent basés sur les graphes spécialisés déjà migrés. Aucune ancienne implémentation de ces workflows n'est reconstituée artificiellement ni exécutée en parallèle.

## Configuration serveur (variables optionnelles nouvelles ; aucun `.env` livré ni modifié)

| Nom | Valeurs | Défaut / effet |
|---|---|---|
| `CVCOMET_CAREER_AGENT_ENGINE` | `graph`, `legacy`, `rollout` | `graph` si absent : préserve le comportement de l'étape 19. Valeur inconnue : legacy. |
| `CVCOMET_CAREER_AGENT_ROLLOUT_PERCENT` | `0` à `100`, max 2 décimales | `0`, utilisé seulement pour `rollout`; valeur invalide = legacy. |
| `CVCOMET_CAREER_AGENT_KILL_SWITCH` | `true`/`1`/`on` | Si activé : legacy, prioritaire sur tout le reste. |

Ces variables doivent être configurées **sur le serveur au déploiement**, jamais dans une requête HTTP. Le déploiement/redémarrage est nécessaire pour toute modification sur un hébergement qui fige les variables d'environnement. Les tokens, identifiants de compte et pourcentages par utilisateur ne sont pas journalisés.

### Plan d'activation recommandé

1. **Préparation staging** : générer et auditer `package-lock.json` dans le vrai dépôt (`npm install --package-lock-only`), le versionner, `npm ci`, sauvegarde Neon staging, `npx prisma migrate deploy`, `npx prisma generate`, puis tests d'intégration et build.
2. **Retour arrière prêt** : déployer avec `CVCOMET_CAREER_AGENT_ENGINE=legacy` uniquement si le scénario de fallback a été validé en staging. Vérifier que le flux SSE des missions produit au moins les événements `mission.started/completed/failed`; les événements détaillés par nœud ne sont pas disponibles avec le legacy.
3. **Canary** : `CVCOMET_CAREER_AGENT_ENGINE=rollout` et 5 %, puis 25 %, 50 %, 100 % après validation humaine, avec des fenêtres de mesure suffisantes. **Ne pas avancer** si la comparaison indique `BLOCKED` ou `INSUFFICIENT_DATA`. Les échantillons doivent avoir au moins 30 exécutions terminées et 30 latences p95 par moteur sur les sept jours observés.
4. **Critères techniques avant progression** : aucune fuite ou action non approuvée; pas de baisse du taux de terminaison LangGraph supérieure à 5 points comparé au legacy; p95 du nouveau moteur <= 55 s; pas de dette de lease ni de perte de métriques critique. Ces seuils sont des garde-fous opérationnels, **pas** une preuve de factualité, de sécurité globale ou de qualité de candidature.
5. **Rollback d'urgence** : activer `CVCOMET_CAREER_AGENT_KILL_SWITCH=true` et redéployer/redémarrer les instances; vérifier qu'une nouvelle requête passe au legacy. **Ne pas** rejouer automatiquement une demande en cours, ne pas réexécuter un email ou une candidature, et respecter les clés d'idempotence des missions. Ne pas supprimer le graphe ni ses migrations pendant le rollback.
6. **Validation finale** : comptabilité de consommation IA, tests de refus inter-compte, consentement vocal LiveKit, mémoire révoquée, échecs fournisseur, protection XSS/CSRF, relevés des p95 par moteur, audit échantillonné de réponses FR/EN avec experts, puis feu vert humain. Seulement après plusieurs fenêtres stables, décider de retirer le legacy **dans un changement ultérieur**, jamais au sein de cette étape.

## Migration et mesures

Migration `20261101010000_agentic_career_rollout_metrics` : colonne `engine` non nullable, défaut `UNKNOWN`, contrainte SQL de valeurs autorisées, index `(engine, createdAt, outcome)`. Les lignes historiques **ne sont jamais réétiquetées** sans preuve. Suppression utilisateur via cascade inchangée. Vérifier la migration sur **Neon staging**, puis déployer; ne pas passer le code Prisma généré avant le DDL.

L'endpoint retourne des statistiques agrégées calculées à partir des événements enregistrés. Elles sont sujettes au biais de sélection de cohortes, aux pannes de télémétrie et aux échantillons tronqués des 1 000 dernières réussites par moteur. Un statut `REQUIRES_REVIEW` ne signifie jamais `READY_FOR_PRODUCTION`.

## Commandes de validation

```bash
# Dans le dépôt de développement, jamais directement sur la production
npm install --package-lock-only   # si aucun lockfile n'existe ; auditer le changement
npm ci
npx prisma migrate deploy         # contre Neon STAGING et avec sauvegarde préalable
npx prisma generate
npm run eval:agentic:local
npm run test:agentic:stage20:integration
npm run eval:agentic:staging
npm run typecheck
npm run build
npm run release:agentic:stage20 -- --staging --report=./stage20-staging-preflight.json
```

Les tests de code et les tests de runtime avec dépendances sont deux preuves différentes. Si le registre npm, un fournisseur IA, Neon ou LiveKit sont inaccessibles, consigner **NON VALIDÉ**, pas `PASS`. Le preflight reporte la présence des composants sans lire les secrets, et liste les vérifications manuelles encore nécessaires.

## Limitations et conditions bloquantes

- Le préflight ne constitue pas une preuve de reprise correcte sur toute l'infrastructure réelle ; un rollback exige un redéploiement et un exercice en staging.
- Les agents spécialisés déjà migrés n'ont pas tous un fallback legacy. Le superviseur est en lecture seule ; il ne déclenche pas automatiquement les graphes d'écriture de ces agents.
- Le flux SSE transporte l'avancement technique, pas des tokens générés non vérifiés.
- Les métriques par moteur ne couvrent que le Career Assistant ; elles ne certifient pas les réponses de tous les agents, le contenu des CV, l'équité, les coûts réels ni les résultats de candidature.
- Le paquet source ne contient pas de lockfile vérifié et l'environnement de génération ne possède pas de dépendances npm ; pas de typecheck complet, build, tests de graphe réel ou migration Neon vérifiés localement.
- Toute fuite de données, prise d'action non approuvée, résurrection de préférences révoquées, test cross-user échoué, incohérence transactionnelle, ou échec du build est **bloquant**.

Aucun fichier de secrets ni valeur `.env` n'a été copié dans le patch cumulatif.
