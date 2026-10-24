# Architecture Career Missions v1 — Étape 07

```text
Session utilisateur (serveur)
        │
        ▼
CareerMission (opt-in, owner-scoped, ACTIVE/ARCHIVED)
        ├── CareerMissionRun (requestKey UUID unique par mission)
        │      ├── RUNNING + leaseToken + leaseUntil
        │      ├── COMPLETED + answer + tool names (no raw tool outputs)
        │      └── FAILED + stable error code
        └── CareerMissionApproval (PENDING/APPROVED/REJECTED/CONSUMED)
               └── SHA-256 de l'action/payload canonique, expiration et consommation CAS
```

## Contrat d'exécution

L'API exige `apiVersion: "v1"`, `message` et `requestKey` UUID, et ne reçoit **aucun identifiant utilisateur, nom d'outil ni confirmation client**. Après vérification propriétaire et mission active, une transaction PostgreSQL met un verrou CAS (`activeRunId`), puis crée un run ou réutilise une tentative échouée. Un run déjà terminé est renvoyé depuis la base. Le `leaseToken` unique empêche une ancienne requête de persister une réponse après reprise. L'absence de réponse lors d'une coupure doit conduire le client à consulter l'historique, puis éventuellement à réessayer **avec le même `requestKey`**.

Le modèle voit seulement les derniers échanges terminés bornés et la question courante, puis exécute la politique de lecture seule de l'étape 06. Les quotas IA existants sont toujours prélevés avant chaque appel. Aucune exécution ne part en arrière-plan lorsque la requête HTTP est terminée.

## Approbations

`proposeCareerApproval` est une fonction exclusivement serveur pour les futurs workflows métier. Elle lie propriétaire + mission + action + hash du payload. La route publique actuelle ne peut que **décider** une demande préexistante. `consumeCareerApproval` exige ensuite une décision positive valide, non expirée, avec le même payload et effectue un CAS `APPROVED → CONSUMED`. Elle n'exécute elle-même aucun appel externe ; un futur outil devra en plus revalider le propriétaire, le droit et la politique d'effets.

## Conservation et confidentialité

Les missions sont explicitement créées, consultables uniquement par leur propriétaire, archivables et supprimables avec cascade. Seules les questions/réponses et les noms d'outils consultés sont stockés ; jamais les contenus bruts des lectures intermédiaires. Les historiques sont paginés et le contexte envoyé à l'IA est borné. La création d'une mission ne constitue pas un consentement à conserver les transcriptions vocales ni à envoyer une candidature.
