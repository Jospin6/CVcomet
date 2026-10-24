# Job Intelligence 2.0 — Contrat de diagnostic explicable

## Entrée
- Offre analysée et exigences citées (`JobAnalysis`).
- Comparaison calculée du profil/CV (`MatchResult` v1). Provenances = données déclaratives appartenant au compte connecté.

## Sortie (`JobIntelligence.version = 2`)
- `assessment`: `INSUFFICIENT_DATA`, `PARTIAL_REVIEW` ou `REVIEWABLE` ; **jamais** un indicateur de probabilité d'embauche.
- `coveragePercent`: proportion d'exigences évaluables et non ambiguës parmi les exigences extraites, indépendante du score historique.
- `demonstratedCount`, `partialCount`, `missingCount`, `verifyCount` : états déjà calculés ; ne créent pas de nouvelles qualifications.
- `hasResume` : distingue une comparaison de profil seul d'une analyse du CV réellement préparé.
- `actions` : au maximum 12 étapes ordonnées (REQUIRED > PREFERRED > MENTIONED ; puis VERIFY > NOT_DEMONSTRATED > PARTIAL > DEMONSTRATED). Chaque étape inclut les faits disponibles, l'extrait de l'offre, un type d'action et un conseil conditionnel.
- `warnings` : limites méthodologiques et avertissements de la source, bornés.

## Interopérabilité
- Les nouveaux calculs persistent `{...MatchResult version 1, intelligence: JobIntelligence version 2}` dans le JSON `jobMatch.result` existant.
- Les analyses anciennes restent chargeables ; l'interface reconstruit le diagnostic à la lecture.
- `get_my_job_match_insights` expose uniquement une sélection bornée, en lecture seule, à partir d'une requête vérifiant **simultanément** `matchId` et `actor.id` ; les entrées supplémentaires sont rejetées par le schéma strict.
- L'agent traite les sorties comme non fiables et ne déclenche aucune mutation.

## Évolutions possibles (non livrées dans cette étape)
- Mesure empirique de la pertinence des conseils avec des recruteurs volontaires.
- Évaluation multimodèle des correspondances paraphrasées, avec citations obligatoires et mesure des erreurs.
- Rapprochement avec l'Evidence Vault sans surévaluer les informations autodéclarées.
- Distinguer années d'expérience, diplômes, certifications et conditions légales via extracteurs spécialisés et vérification manuelle.
