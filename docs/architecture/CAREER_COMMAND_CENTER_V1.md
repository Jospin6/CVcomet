# Career Command Center — Architecture UI v1

## Invariants

- Les moteurs CV, lettres, carrière, ATS, entretiens et candidatures sont **réutilisés** ; aucune duplication de logique métier.
- Le Career Agent reste en lecture seule, et les suggestions de prompts ne lancent aucun appel réseau avant la validation de l'utilisateur.
- La synthèse est un **composant client** avec lectures limitées, `same-origin`, `no-store` et `AbortController`. Aucune API privée n'est consultée sans session.
- Les métriques affichées viennent de réponses d'API validées par des projections pures, jamais de constantes ; impossible de confondre « 0 » et « inaccessible ».
- `GET /api/applications?page=1&pageSize=1&archived=false` fournit `total` ; `GET /api/career/v1/missions?limit=30` est paginé et ne donne que le nombre de missions **dans la page affichée**. Ne pas présenter ce dernier comme un total exhaustif.
- La bibliothèque de CV reprend `useResumeLibrary` (CV internes et importés), avec états erreur/chargement.
- La politique `chooseCareerNextStep` est pure et n'agit pas sur les données.
- L'interface supporte les thèmes clair/sombre par tokens CSS existants et suit les préférences de réduction du mouvement.
- La navigation distingue les chemins des sous-écrans, afin que le parent reste actif.

## Recette UX minimale

1. Visiteur déconnecté : les métriques valent « — » et aucun appel de synthèse privée n'est effectué.
2. Session active + CV vide : action suivante « premier CV ».
3. Session active + CV existant, aucune candidature : lien d'analyse d'offre.
4. Session active + CV et candidatures : préparation d'un dossier.
5. API de candidatures en erreur : état « — » ; aucune interprétation en zéro.
6. Agent : sélectionner une suggestion remplit la zone de saisie et met le focus ; le texte n'est envoyé qu'après clic sur Envoyer.
7. Palette : Ctrl/Cmd K, recherche sans accent, flèches et Enter ouvrent bien l'élément sélectionné.
8. Responsive 320/375/768/1440px, clavier seul, zoom 200 %, thèmes clair/sombre et langues FR/EN.

## Évolution future

N'ajouter des actions agentiques sur ces écrans que lorsque les contrats d'autorisation, approbations, audit et idempotence sont réellement implémentés et vérifiés de bout en bout. Les indicateurs métiers plus avancés nécessiteront des endpoints agrégés dédiés, avec pagination et fraîcheur explicites.
