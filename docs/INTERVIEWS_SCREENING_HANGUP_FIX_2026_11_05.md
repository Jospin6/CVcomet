# CVComet — AI Screening Call: arrêt immédiat et rapports conditionnels

## Problème corrigé

Auparavant `End call` déclenchait `VOICE_ENDING`, ce qui demandait toujours
un rapport au worker et mettait le frontend en attente/polling, y compris après
un échec de connexion LiveKit.

## Nouveau comportement

- **Raccrocher / Hang up** ferme immédiatement la salle côté client et envoie
  une annulation au serveur (`POST /api/interviews/screening/:id/end` avec
  `{ "action": "cancel" }`). Le serveur marque la session `VOICE_CANCELLED`
  avant de supprimer la salle LiveKit. Il ne crée ni transcription ni rapport.
- **Échec LiveKit, refus du micro, déconnexion inattendue** : annulation et
  retour à la liste. Un message explique l'échec, sans écran de rapport.
- **Terminer et évaluer / Finish & report** est distinct : une session connectée
  peut demander `{ "action": "finish" }`. Le serveur passe en `VOICE_ENDING`
  *avant* de supprimer la salle. Le worker peut ensuite générer le rapport.
- La callback protégée du worker refuse une évaluation si la session n'est
  pas `VOICE_ENDING` ; si moins de 2 réponses candidat exploitables ont été
  recueillies, la session est annulée **sans aucun rapport**, même si l'utilisateur
  a demandé une évaluation.
- La page n'attend plus le rapport en bloquant l'utilisateur. Pour un vrai
  entretien terminé, le rapport apparaîtra dans les entretiens enregistrés une
  fois l'évaluation faite. Une annulation pendant `VOICE_EVALUATING` empêche
  la sauvegarde d'un résultat concurrent.
- Lors d'une fermeture d'onglet, la requête d'annulation est également tentée
  en `keepalive` (best effort ; la réussite dépend du navigateur et du réseau).
- Pas de nouvelle table, de migration Prisma ou de nouvelle variable d'environnement.

## Vérification

```bash
node --experimental-strip-types --test scripts/interviews-screening-2026.test.mjs scripts/interviews-screening-cancellation.test.mjs
```

Redéployer **Next.js** après le correctif. Le worker LiveKit peut être redémarré
lors du déploiement pour éviter des sessions héritées, même si aucun changement
au fichier du worker n'est requis dans ce correctif.

Un test end-to-end connecté à la vraie base, à LiveKit, à OpenAI Realtime et au
micro du navigateur reste requis sur l'environnement cible.
