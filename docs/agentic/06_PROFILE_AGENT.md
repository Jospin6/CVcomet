# Étape 06/20 — Profile Agent LangGraph (CVComet 3.0)

**Base** : `cvcomet(3).zip` + les étapes cumulatives 01–05.

## Périmètre livré

- Vrai graphe `StateGraph` : `load_profile` → `extract` → `verify` → `reconcile` → `review`.
- Modules indépendants sous `src/lib/agentic/agents/profile/{agent,nodes,tools,prompts}`.
- Appel effectif depuis `POST /api/career-profile/import` ; formats PDF, DOCX et TXT conservés.
- Extraction structurée via l'AI SDK et le fournisseur configuré ; le texte utilise le `cvcometAgentModel` et le quota `PROFILE_IMPORT` des étapes précédentes. Les PDF scannés gardent le chemin multimodal Google/Anthropic existant.
- Lecture du profil avec l'identité obtenue de la session, jamais une identité fournie par l'IA.
- Vérification des ancrages factuels dans le texte source : les faits non vérifiables sont écartés de la proposition, puis signalés. Les PDF scannés sans texte reçoivent un avertissement de revue humaine.
- Détection déterministe de conflits entre une nouvelle extraction et le profil courant ; pas de fusion destructive.
- Élimination des doublons exacts ; signalement des doublons probables et des entrées dépourvues du titre/degré nécessaires.
- Le profil proposé n'inclut pas d'inférence de marché, pays cible, préférences, objectif de carrière ni de changement d'email de compte.
- Réponse de l'API : `extracted`, `proposal`, `review`, `baseRevision`, `requiresConfirmation`, `source`. Le `current` du graphe et le fichier d'origine ne sont pas retournés.
- Dans Career Profile, aperçu compact des champs proposés et des conflits ; l'utilisateur vérifie et valide. Le PUT existant conserve sa validation Zod, sa confirmation et sa vérification transactionnelle de `profileRevision`.
- Le graphe ne possède **aucun outil d'écriture**, n'applique aucun changement automatique et ne persiste ni le CV source ni les informations personnelles dans un checkpoint LangGraph.

## Sécurité et revue humaine

Le parcours d'approbation reste le formulaire métier existant, non un `interrupt()` LangGraph : le CV et le profil contiennent des données personnelles ; les checkpoints doivent donc rester limités aux identifiants/révisions si un parcours durable est ajouté ultérieurement. Une extraction depuis un CV ne vaut jamais consentement pour remplacer le profil. Le frontend conserve les modifications locales non enregistrées et le backend rejette les enregistrements basés sur une révision périmée.

Les prompts ne sont pas des permissions. Les règles réelles de validation, d'identité, de conflit et de sauvegarde restent dans le code TypeScript/Prisma.

## Tests

```powershell
npm run test:agentic:stage06
npm run test:agentic:stage06:integration
npm run typecheck
npm run build
```

Le test d'intégration exige les dépendances npm et un client Prisma généré. Il exécute le **véritable StateGraph** avec extraction et dépôt injectés : pas d'appel au modèle, pas de requête PostgreSQL, pas de dépense IA. Il doit échouer plutôt qu'être ignoré lorsque LangGraph est absent.

## Validation fonctionnelle manuelle

1. Importer un CV avec expériences/compétences dans Profile ; vérifier la proposition, puis enregistrer explicitement.
2. Importer à nouveau le même CV : aucun doublon ajouté.
3. Importer un CV avec un titre/poste existant mais un texte différent : afficher un conflit, conserver la version actuelle jusqu'à revue.
4. Importer un CV contenant une expérience sans intitulé : elle ne doit pas bloquer tout l'import ni être enregistrée comme une expérience invalide.
5. Éditer un champ du profil sans enregistrer, importer un nouveau CV : vérifier que ce brouillon n'est pas écrasé.
6. Pendant l'import, modifier le profil dans une autre session, puis tenter de sauvegarder : attendre `409 CONFLICT`.
7. Tester des fichiers PDF, DOCX et TXT, fichiers malformés ou dépassant 8 Mo, quotas épuisés et session expirée.
8. Vérifier que l'email vérifié et les préférences de carrière ne changent pas automatiquement.

## Limites

- Pas de gestion durable de l'import : le document et les données personnelles ne sont pas checkpointés.
- Le parcours de revue se fait par les mécanismes actuels de la page Profile et non par un endpoint supplémentaire de reprise `Command`.
- Le TypeScript complet, le build Next.js, les vrais providers et Neon doivent être testés sur l'installation contenant `node_modules`.
- L'analyse des doublons probables est conservatrice ; l'utilisateur doit confirmer les divergences.
- Aucun autre agent métier n'a été migré.
