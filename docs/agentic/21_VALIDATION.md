# Assistant multimodal — résultats de la validation locale

- Parser TypeScript/TSX : à reporter depuis `npm run check:syntax`.
- Tests de l'extension : `npm run test:assistant:multimodal` (vérifie signatures de fichiers, taille, hachage idempotent, métadonnées privées, validation des routes, coût/quotas vocaux).
- Tests de non-régression : `npm run eval:agentic:local`.
- Test de la vraie orchestration : `npm run test:assistant:multimodal:integration`, nécessite `npm install`/LangGraph installé. Si les dépendances manquent, **échec attendu, pas un test passé**.
- `npm run typecheck`, `npm run build`, et migration Neon staging : **non vérifiés** dans le container de génération (dépendances absentes).

La présence d'un sous-graphe réel dans le superviseur ne veut pas dire que les workflows ATS, Resume, Cover Letter, Job Discovery, Application ou Interview Voice sont directement exécutables depuis une instruction textuelle : seul le branchement de prévisualisation Career Map est ajouté ici. Tous restent accessibles avec leurs autorisations et validations par les pages spécialisées.
