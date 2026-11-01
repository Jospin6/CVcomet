# CVComet / LangGraph — étape 05 : Context Engine

## Objet et portée

Implémenter la lecture **éphémère, sélective et autorisée** des faits professionnels pour les agents futurs. La source de vérité reste le profil professionnel et les documents enregistrés dans Prisma/Neon. Les services métier, les pages, les routes, les prompts et les checkpoints ne sont pas modifiés. Aucun agent métier n'est activé à cette étape.

## Architecture

```text
src/lib/agentic/
├── core/context/limits.ts          # bornes génériques indépendantes du métier
├── context/career/
│   ├── contracts.ts                # identité, sélecteurs, contrat repository et snapshot
│   ├── policy.ts                   # scopes autorisés par agent, sélecteurs stricts
│   ├── projectors.ts               # listes blanches des champs de contexte
│   ├── engine.ts                   # chargement, vérifications, projection, limites
│   ├── prisma-repository.ts        # requêtes Prisma avec contrôle propriétaire
│   ├── tool.ts                     # outil de lecture soumis au registre de l'étape 04
│   └── index.ts                    # point d'entrée pur, sans import Prisma
└── agents/<agent>/                 # arborescence agent/nodes/tools/prompts inchangée
```

## Politique de récupération

- Les sélecteurs acceptent uniquement `profile: true`, `resumeId`, `jobId`, `applicationId`, `coverLetterId` (UUID). Aucun `userId` ou `actorId` ne peut être transmis dans les arguments.
- L'identité provient du serveur authentifié et doit être construite par le code appelant. Un LLM ou une requête HTTP ne peuvent pas la fournir.
- Le serveur consulte uniquement les ressources demandées. Les requêtes de CV et lettres filtrent par `conversation.userId` ; celles d'offres et candidatures filtrent par `userId`.
- En présence d'une candidature, les identifiants explicitement sélectionnés doivent être cohérents avec ses liens existants. Les lettres rattachées à un CV ou une offre incompatible sont refusées.
- Les agents `ats` et `job-match` sont explicitement **interdits de contexte de profil** : leurs évaluations doivent porter sur le contenu du CV envoyé et de l'offre. Les sections cachées par `design.hiddenSections` ne sont pas envoyées au modèle.
- Les autres agents reçoivent les types de ressources prévus dans `CAREER_CONTEXT_SCOPES` et seulement si elles sont demandées.
- `projectors.ts` établit une liste blanche de champs métier. E-mails, téléphones, adresses et champs d'authentification/billing sont exclus ; seule la **présence** des coordonnées du CV est indiquée.
- Taille limitée par champ, nombre de rubriques limité et taille totale de la projection <= 30 000 caractères. En cas de dépassement, échec explicite plutôt que de transmettre un contexte illimité.
- Aucune donnée brute du document dans les événements d'exécution. Les textes des documents sont **des données non fiables**, jamais des instructions système ou des autorisations.
- `references` reste côté serveur (identifiants et révisions). `modelContext` ne contient que les faits projetés, sans identifiants de ressources.
- Le contexte doit rester **éphémère** : conserver dans les checkpoints uniquement les UUID et révisions ; recharger les faits après interruption/reprise, puis revérifier les droits et versions avant les écritures.

## Utilisation par un futur nœud métier (exemple conceptuel)

```ts
import { createCareerContextEngine } from "@/lib/agentic/context/career";
import { prismaCareerContextRepository } from "@/lib/agentic/context/career/prisma-repository";

const contextEngine = createCareerContextEngine(prismaCareerContextRepository);
const snapshot = await contextEngine.load({
  identity: trustedServerIdentity, // jamais les arguments du modèle
  selectors: { resumeId: trustedSelectedResumeId, jobId: trustedJobId },
  signal,
});
// snapshot.modelContext = contexte de données non fiables pour un prompt encadré
// snapshot.references = références serveur pour vérification de révision
// Ne PAS enregistrer snapshot.facts / snapshot.modelContext dans LangGraph state.
```

On peut également enregistrer `registerCareerContextReadTool(registry, repository)` dans le `AgentToolRegistry` de l'étape 04. Chaque appel à l'outil récupère l'identité du `AgentToolContext` serveur et repasse par les mêmes règles de scopes, validation et autorisation.

## Limites explicites

- Ne constitue **pas** une mémoire durable ou une recherche vectorielle. Celles-ci sont prévues à l'étape 17.
- L'outil de contexte ne réalise aucune modification ; les opérations d'écriture restent soumises aux politiques de l'étape 04 et aux transactions des futurs outils métier.
- La projection est destinée à fournir un contexte LLM **réduit**. Les moteurs ATS et Job Match continuent d'utiliser leurs données structurées complètes pour les calculs déterministes.
- Les fiches volumineuses peuvent être limitées ; ne jamais traiter cette projection comme une archive exhaustive des documents.
- La vérification utilisateur doit être effectuée **à la frontière de l'API ou du worker** avant de construire `trustedServerIdentity`. Cette étape n'ajoute pas de nouvelle API.
- Pour des lectures parfaitement cohérentes à un instant donné malgré les modifications concurrentes, les futurs workflows doivent revalider les révisions, ou lire via une transaction avec isolation adaptée.
