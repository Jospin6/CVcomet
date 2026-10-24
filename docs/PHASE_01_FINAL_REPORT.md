# CVComet 2.0 — Étape 01 / Architecture et fondations agentiques

**Date :** 24 octobre 2026  
**Statut :** développement local de l'étape 01 terminé ; **recette DB/auth/build en staging non exécutée**.

## Résultat technique de l'étape 01

- Monolithe Next.js existant conservé : aucune reconstruction, aucun microservice, aucune bibliothèque NPM ajoutée.
- Nouveau noyau `src/lib/career-os/` : contrat versionné `v1`, catalogue des outils, politique *deny by default*, télémétrie sans PII, enveloppes/erreurs API et contrat de clés d'idempotence.
- Nouveau endpoint `GET/POST /api/career/v1/tools` authentifié, lecture seulement, JSON limité à 8 KiB, contrôles d'origine, entrée validée par Zod, réponses `no-store`, request IDs corrélés.
- 4 outils réellement exécutables, réutilisant le métier : `get_my_profile`, `list_my_resumes`, `get_my_resume`, `list_my_applications`. Les DB queries sont limitées au propriétaire dès le `where` Prisma. Aucune permission globale admin pour lire d'autres dossiers.
- 5 outils futurs visibles dans le catalogue comme **indisponibles**, dont toutes les actions externes (envoi de candidature et d'email). Aucun modèle ne peut les déclencher.
- Documents d'architecture avec diagramme, frontières de modules, spécification API, protocole des permissions, idempotence future et ordre d'intégration de l'agent.

## Tests exécutés

| Contrôle | Résultat |
|---|---|
| `npm run test:phase00` | **25/25** tests ciblés passent |
| `npm run test:phase01` | **14/14** tests ciblés passent |
| **Total** | **39/39** tests ciblés passent |
| Transpilation syntaxique TypeScript/TSX des fichiers `src/` | **333 fichiers**, aucune erreur syntaxique détectée |
| Typecheck projet entier avec toutes les dépendances | **Non exécuté :** `node_modules` de CVComet absent |
| Tests HTTP réels / PostgreSQL / Better Auth | **Non exécutés :** environnement staging et credentials absents |
| Prisma migrate / Next build | **Non exécutés** |

Les tests des routes et du registre utilisent surtout des invariants/analyses statiques car les dépendances du projet ne sont pas installées. Ils ne remplacent pas une recette d'intégration.

## Compatibilité et migrations

- Endpoints de phase 00 et interfaces UI existantes **inchangés**.
- `package.json` ajoute seulement `test:phase01` et `test:cvcomet:baseline`.
- `tsconfig.json` active `allowImportingTsExtensions` (compatible avec le projet `noEmit` et le bundler TS) pour permettre l'exécution Node des tests de politiques TypeScript.
- **Aucune nouvelle migration Prisma pour l'étape 01.** Les migrations phase 00 restent nécessaires sur la base d'installation.
- Aucune nouvelle variable d'environnement requise par l'étape 01 ; les secrets phase 00 demeurent requis par les fonctions existantes.

## Limitations à conserver explicitement

1. L'assistant `/api/assistant` n'appelle pas encore les outils : **tool calling du LLM = étape 06**.
2. Les tools actifs sont de **lecture seulement** : pas de génération de brouillons, de mutation, d'envoi, ni d'achat.
3. L'idempotence des futures **écritures** exige un ledger transactionnel persisté : le helper phase 01 seul **ne garantit pas l'absence de doubles actions**.
4. La mémoire des faits confirmés, la provenance des compétences et les validations de CV sont en étape 02.
5. Les tests des règles de propriété SQL sont actuellement structurels ; ils doivent être complétés par tests e2e cross-account avec deux vrais comptes sur base isolée.

## Recette staging avant mise en production

Depuis le projet source avec les fichiers du ZIP cumulatif appliqués :

```bash
npm install
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npm run test:cvcomet:baseline
npm run typecheck
npm test
npm run build
```

Créer deux comptes A et B en staging, deux CV et candidatures séparés. Vérifier que A peut accéder aux quatre tools sur ses données, mais qu'il ne peut pas lire le CV de B avec `get_my_resume`. Contrôler 401 sans session, 400 sur `userId` additionnel et sur version `v2`, et 404 sur `send_application_email` / tout nom de tool non disponible. Rejouer la recette phase 00 pour Stripe et emails.

## Étape suivante

**Étape 02 — Career Identity & Evidence Vault** : profil professionnel canonique, faits normalisés, source, statut confirmé/non confirmé, révocation et utilisation traçable lors des futures générations. Nous réutiliserons les contrats et policies de l'étape 01.

## Règle de livraison

Le ZIP cumulé phase 00 + étape 01 ne contient **que les fichiers nouveaux ou modifiés comparés à `cvcomet.zip` initial**, chacun au chemin relatif d'origine. Les 75 chemins de la phase 00 sont conservés à leur version la plus récente. Un manifeste externe récapitule les chemins et SHA-256, sans joindre de secrets, dépendances ou fichiers initiaux inchangés.
