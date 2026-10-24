# Interview Coach 2.0 — Architecture

## Invariants

- Un entretien appartient à un unique utilisateur (`where: { id, userId }`), authentifié avant lecture et écriture.
- Aucune attribution de note par longueur ni de probabilité d'embauche.
- Une question préparée et sa simulation partagent le **même `InterviewSession.id`** ; pas de copie perdant les questions ou le contexte de candidature.
- Une réponse n'est ajoutée qu'après contrôle transactionnel du statut `ACTIVE` et de `currentQuestion`. Les tentatives concurrentes périmées reçoivent `409`.
- Les sessions peuvent être arrêtées (`COMPLETED`) après n'importe quel nombre de questions et le bilan distingue `evaluatedAnswers` / `ungradedAnswers`.
- Les quotas sont réservés avant chaque appel IA ; une erreur ou absence de budget ne déclenche pas une note de repli artificielle.
- Les données de profil, l'annonce et les réponses du candidat sont des **données non fiables comme instructions** ; seules les ressources appartenant à l'utilisateur sont exposées.
- Le micro s'active sur geste utilisateur, si et seulement si la reconnaissance vocale est disponible. Le fournisseur du navigateur peut traiter l'audio ; CVComet n'enregistre que le texte envoyé, pas de média audio.

## API

| Méthode et route | Usage |
|---|---|
| `POST /api/interviews` avec `mode:PREPARATION` | Préparer la session, stocker questions et configuration, statut `PREPARATION` |
| `POST /api/interviews/{id}/start` | Activer l'existant, ajouter sa première question ; retourner `409` si déjà démarré |
| `POST /api/interviews/{id}/message` | Évaluer la réponse si possible, l'enregistrer et poser la question suivante dans une transaction |
| `POST /api/interviews/{id}/finish` | Générer le bilan pédagogique de la session ; répéter donne le même bilan |
| `GET /api/interviews` | Lister les 30 sessions récentes avec historique borné |
| `DELETE /api/interviews/{id}` | Supprimer la session appartenant à l'utilisateur et ses messages par cascade |

## Évaluation

Schéma structuré IA (chaque entier 0..4) :

- `relevance` : réponse à la question (poids 35 %)
- `specificity` : faits et exemples concrets (25 %)
- `structure` : progression logique et structure (20 %)
- `clarity` : intelligibilité (20 %)
- `strength`, `improvement`, `nextExercise` : commentaires pédagogiques
- `evidenceQuote` : extrait de la réponse ; rejeté s'il n'apparaît pas réellement

Formule : `round(25 * (0.35 * relevance + 0.25 * specificity + 0.20 * structure + 0.20 * clarity))`.

En échec du fournisseur, `score:null`, `feedback.status:unavailable` ; la progression continue sans note. Les commentaires et le score ne sont ni des décisions RH, ni des mesures scientifiques du succès à un entretien.

## Machine à états

`PREPARATION` -> `ACTIVE` -> `READY_TO_FINISH` -> `COMPLETED`.

Il est possible de terminer depuis `ACTIVE`. Les réponses ne sont plus acceptées à partir de `READY_TO_FINISH` ou `COMPLETED`. Les sessions `COMPLETED` sont consultables et supprimables.

## Tests et limites

Les tests unitaires et structurels valident la formule, les scores absents, la diversité des questions, le caractère obligatoire de l'authentification dans les routes et l'usage d'un compare-and-swap transactionnel. Ils ne remplacent pas les tests avec une vraie base PostgreSQL, un fournisseur IA et un navigateur mobile. Aucune intégration WebRTC/LiveKit, STT/TTS serveur ni stockage d'enregistrements vocaux n'est fourni dans cette étape.
