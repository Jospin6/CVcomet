# ATS Checker — deux modes, candidature et lettre de motivation

## Utilisation

Le seul point d'entrée ATS reste `/dashboard/resumes/[id]` → onglet ATS.

1. **CV seul (général)** : contrôle les contenus du CV actuellement modifié dans l’éditeur et, si son PDF peut être généré/lu, la lisibilité ATS du PDF. Aucune description d’offre n’est utilisée ; aucun score Job Match n’est affiché.
2. **Avec une offre d’emploi** : utilise la description complète issue d’une candidature liée, d’une offre enregistrée sélectionnée ou d’un texte d’offre collé (au moins 100 caractères). Le score Job Match ne peut apparaître qu’après une analyse réussie des exigences.

Si le CV appartient à plusieurs candidatures, l’utilisateur sélectionne la candidature souhaitée. Les relations CV/candidature/offre/lettre sont vérifiées côté serveur et limitées à l’utilisateur authentifié.

La **lettre de motivation** d’une candidature liée est chargée côté serveur. Sans lettre liée, l’interface permet de coller un texte, d’importer un PDF/DOCX/TXT ou de donner une URL HTTPS publique. Les URL internes, locales, non HTTPS et les redirections ne sont pas suivies. Les fichiers sont limités à 3 Mo, et le texte extrait à 12 000 caractères. Les liens authentifiés non publics doivent être téléchargés puis importés en fichier.

La lettre ne remplace pas la description de poste. Elle sert uniquement à vérifier des mentions explicites du poste et de l’entreprise ; elle ne prouve jamais une compétence présente dans le CV et ne modifie aucun score.

## Traitement des erreurs

- Si le PDF ne peut pas être généré ou inspecté, la lisibilité PDF reste **non évaluée** et les contrôles du contenu restent accessibles.
- Si LangGraph échoue après les vérifications d’accès, une analyse **partielle** déterministe est retournée. Les scores dépendant de l’IA et de la description d’offre restent **non évalués**.
- Les erreurs de saisie, de candidature non liée, de description manquante et de base de données sont distinguées. Le message brut des fournisseurs IA n’est pas exposé à l’utilisateur.
- Les informations de la lettre sont traitées pendant la requête, mais le texte brut de la lettre n’est **pas** enregistré dans le rapport ATS.

## Candidatures

Les nouvelles candidatures doivent être créées avec un `jobId` correspondant à une offre enregistrée dont la description contient au moins 100 caractères, et un `cvId` appartenant à l’utilisateur. Le formulaire de création et le flux « Find Jobs » demandent désormais le CV avant création. Les anciennes candidatures incomplètes restent consultables, mais doivent être complétées pour une analyse associée à l’offre.

Les modifications apportées au CV dans l’éditeur ne sont jamais sauvegardées automatiquement par l’ATS. Les corrections proposées restent soumises à la validation de l’utilisateur.

## Installation

Copiez le contenu du dossier `cvcomet/` de l’archive dans le projet, sans écraser `.env` ou `node_modules`. Exécutez le script `APPLY_ATS_CLEANUP.ps1` si la page `/dashboard/ats` existe encore, puis :

```powershell
node --test scripts/ats-editor-only.test.cjs
npx prisma generate
npm run typecheck
npm run build
```

Aucune nouvelle migration Prisma n’a été créée. Les modèles et routes déjà présents sont réutilisés. Les validations avec une vraie base Neon et les fournisseurs IA doivent être réalisées dans votre environnement.
