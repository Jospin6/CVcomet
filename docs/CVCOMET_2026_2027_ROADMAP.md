# CVComet 2.0 — Feuille de route de transformation internationale

**Date de référence :** 24 octobre 2026  
**Source :** audit statique de l'archive CVComet fournie.  
**Principe :** conserver et améliorer le projet existant ; pas de reconstruction totale.

## Résultat produit recherché

CVComet devient un **AI Career Copilot** : CV + lettres de motivation + dossier de preuves professionnelles + analyse d'emploi + candidatures + entretiens + suivi. Les fonctionnalités doivent fonctionner individuellement ET dans des missions agentiques coordonnées, avec autorisations et visibilité pour l'utilisateur.

### Différenciateurs non négociables

1. **Exactitude** : pas de compétences, employeurs, chiffres ou diplômes inventés. Toute suggestion factuelle indique sa provenance et son niveau de confirmation.
2. **Agent avec autonomie contrôlée** : outils enregistrés et autorisés, périmètre utilisateur, confirmations des écritures sensibles, annulation et reprise.
3. **International** : ciblage explicite du pays et de la langue ; normes contextualisées et versionnées, sans généralisation continentale abusive.
4. **Documents professionnels** : PDF/DOCX lisibles par humains et logiciels, mise en page soignée et accessible, plusieurs variantes et versions.
5. **Parcours complet** : de l'offre au dossier prêt à déposer, avec suivi et préparation aux entretiens.
6. **Confiance** : confidentialité, maîtrise des coûts IA, tests de qualité, observabilité et contrôles antidiscrimination.

## Règles d'exécution

- Avancer **étape par étape**, sans fusionner plusieurs phases non testées.
- Auditer l'implémentation déjà présente avant toute création de module.
- Travailler avec le frontend et le backend réels ; n'introduire ni API fictive ni données inventées.
- Conserver le stack Next.js, React, TypeScript, Prisma et PostgreSQL ; n'ajouter une dépendance qu'avec une justification.
- Fournir à chaque étape : fichiers modifiés, migration si nécessaire, tests, env à configurer, actions manuelles et limites.
- Toute sortie de modèle et tout contenu distant sont considérés non fiables.
- Les actions impactant une identité, un paiement, un email, une publication ou une candidature exigent une autorisation explicite indépendante du modèle.

## Phases et critères de sortie

### Étape 00 — Fondations, audit et sécurité (P0)
**Périmètre :** identité, flux email, protections propriétaires, sauvegardes, quotas, tests reproductibles et CI.

**Tâches :**
- Inventorier API, modèles Prisma et permissions ; tracer risques P0/P1.
- Sécuriser les codes d'email (HMAC, TTL, anti-brute-force, cooldown et anti-énumération).
- Ajouter un limiteur distribué par IP / utilisateur sur la vérification et les coûts IA.
- Vérifier l'unicité des identités et la coexistence Better Auth / routes héritées.
- Centraliser les budgets, les quotas et les permissions des endpoints IA.
- Établir lockfile, exécution des migrations sur DB de test, CI lint/typecheck/test/build, tests de permissions.
- Préparer politiques de conservation des données CV, suppression et gestion sécurisée des pièces jointes.

**Sortie :** build reproductible, endpoints P0 testés (y compris accès croisés), premiers tests automatisés verts, migration vérifiée sur DB de test.

### Étape 01 — Architecture modulaire 2.0 (P0)
**Périmètre :** frontières domaine, API/DTO, flux de génération, stratégie des événements, permissions et versionnage.

**Tâches :** contrats intermodules, gestion des erreurs, idempotence, services réutilisables, observabilité de base. Ne pas introduire des microservices sans nécessité mesurée.

**Sortie :** diagramme de composants, catalogue d'API/outils, conventions et tests de compatibilité.

### Étape 02 — Career Identity & Evidence Vault (P0)
**Périmètre :** profil professionnel canonique et traçabilité des informations.

**Tâches :** créer CandidateFact, FactSource, FactVerification, FactUsage (ou équivalents), importer CV et informations fournies volontairement, dédupliquer, confirmer ou révoquer les faits.

**Sortie :** une expérience ou compétence citée dans une génération renvoie au fait source et à son statut de validation ; permissions et suppression testées.

### Étape 03 — AI Resume Engine 2.0 (P0)
**Périmètre :** édition, variations, cohérence, réécriture, rendu.

**Tâches :** source de vérité du CV, moteur de modifications en brouillon, aperçu diff, validation avant sauvegarde, versions, undo/redo, tests PDF/DOCX et extraction.

**Sortie :** CV généré sans faits inventés, lisible par extraction, historique récupérable, aucune écriture sensible sans validation.

### Étape 04 — Cover Letter Intelligence 2.0 (P0)
**Périmètre :** lettres naturelles et contextualisées.

**Tâches :** ton, entreprise, rôle, pays, objectifs, justification de chaque paragraphe, cohérence avec CV, écriture en brouillon, export PDF/DOCX, détection de formulations vides.

**Sortie :** lettre fidèle au profil et à l'offre, plusieurs tons sans hallucinations, modifications approuvables.

### Étape 05 — Global Career Localization (P1)
**Périmètre :** pays de candidature + langue + secteur + niveau + type d'employeur.

**Ordre recommandé :** RDC, France, Belgique, Suisse, Canada FR/EN, États-Unis, Royaume-Uni, Allemagne, puis extension guidée par les utilisateurs.

**Sortie :** règles versionnées et validées par cas réels ; options sensibles (photo, date de naissance, adresse) contextualisées, non imposées.

### Étape 06 — Career Agent & Tool Calling (P0)
**Périmètre :** orchestrateur central unique avec outils spécialisés et à accès minimal.

**Premiers outils :** get_my_profile, list_my_resumes, get_my_resume, analyze_job, match_job, draft_resume_changes, draft_cover_letter, list_my_applications, create_application_draft.

**Contrôles :** identités serveur, validation Zod, quotas, timeout, budget de tokens et d'appels, refus explicites, audit d'outil. Aucune autorisation ne découle du contenu d'un prompt.

**Sortie :** mission de candidature complète en lecture + brouillons, sans pouvoir envoyer une candidature.

### Étape 07 — Mémoire et missions persistantes (P0)
**Périmètre :** fils de conversation, contexte choisi, AgentRun/AgentStep, propositions en attente.

**Tâches :** reprise, états, checkpoint, idempotence, gestion retry/cancel, expiration d'une approbation, suppression des souvenirs sur demande.

**Sortie :** interruption suivie d'une reprise sans tâche dupliquée ni fuite entre utilisateurs.

### Étape 08 — ATS & Job Intelligence 2.0 (P1)
**Périmètre :** parsing d'offres, extraction d'exigences, matching explicable.

**Tâches :** exigences obligatoires/facultatives, preuve manquante, conformité aux normes de parsing, sources à jour, résilience des intégrations d'offres.

**Sortie :** recommandations justifiées et compréhensibles, sans promesse de taux d'embauche.

### Étape 09 — Application Agent (P1)
**Périmètre :** préparation du dossier et aide à la soumission.

**Tâches :** email de candidature, réponses aux formulaires en brouillon, pièces jointes validées, journal des soumissions, intégrations autorisées, confirmation forte avant envoi.

**Sortie :** zéro candidature envoyée sans validation explicite et visible ; respect des CGU des plateformes concernées.

### Étape 10 — Interview Coach avancé (P1)
**Périmètre :** texte puis voix, feedback basé sur des rubriques explicites.

**Tâches :** questions adaptées au métier/niveau, évaluation sémantique et exemples, méthode STAR quand applicable, suivi des progrès et limites des scores.

**Sortie :** aucun score dérivé de la longueur seule ; réponses améliorées avec conseils détaillés.

### Étape 11 — UX/UI Career Command Center (P1)
**Périmètre :** interface cohérente web / mobile responsive, modes clair/sombre, accessibilité.

**Tâches :** missions visibles, assistant avec cartes, profils et documents, tableaux de bord, actions intelligentes, prévisualisations, navigation.

**Sortie :** parcours complet sans impasse sur desktop et mobile ; navigation clavier, lecteurs d'écran et audits WCAG.

### Étape 12 — Pricing et contrôle financier (P1)
**Périmètre :** offre gratuite utile, plans payants, crédits IA, quotas, analytics économiques.

**Sortie :** tarifs configurables, droits cohérents entre API/UI, paiements vérifiables, marge et coût par mission mesurés.

### Étape 13 — Évaluations IA, conformité et observabilité (P0 transversal)
**Périmètre :** corpus d'évaluation anonymisé et autorisé, sécurité, latence, erreurs, coûts et qualité.

**Sortie :** tableau de bord d'indicateurs, tests d'injection de prompt, refus/permissions, absence de fuite des données, scénario de rollback.

### Étape 14 — Bêta internationale et lancement (P1)
**Périmètre :** premiers marchés, utilisateurs pilotes, amélioration produit, acquisition et rétention.

**Sortie :** preuves d'utilité sur des parcours complets, taux de rétention, taux de documents acceptés, support fiable et préparation à l'échelle.

## Scorecard permanente

| Indicateur | Mesure | Cible de principe |
|---|---|---|
| Faits inventés | Révision humaine des assertions professionnelles | 0 assertion non confirmée publiée comme fait |
| Sécurité | Tests d'accès intercomptes et appels d'outils | 0 accès non autorisé |
| Documents | Extraction et rendu vérifiés sur corpus multi-pays | Suivi systématique des régressions |
| Agent | Missions terminées avec contrôle utilisateur | Mesurer le succès bout en bout |
| Budget | Coût par mission / utilisateur et plafonds appliqués | Pas de boucle IA non bornée |
| Expérience | Actions nécessaires pour un dossier prêt | Réduction à chaque version |
| Fiabilité | Latences p50/p95, erreurs, reprises | SLO documentés et suivis |

## Décision de démarrage

- **Phase active : 00 — Fondations, audit et sécurité.**
- **Lot initial : 00.1 — Vérification email héritée** (implémentation locale, migration, tests isolés).
- **Prochaine tâche :** tester 00.1 sur PostgreSQL et l'envoi Resend, installer un limiteur distribué et vérifier la coexistence des parcours Better Auth avec les endpoints historiques.

Les étapes ne sont marquées « terminées » qu'après validation de l'ensemble de leurs critères de sortie.
