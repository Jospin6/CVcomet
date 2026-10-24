# CVComet 2.0 — Étape 05/14 — Global Career Localization

**Date :** 24 octobre 2026  
**État :** implémentation locale terminée, *non certifiée pour la production*.  
**Livraison :** ZIP cumulatif des phases 00, 01, 02, 03, 04 et 05, uniquement fichiers créés/modifiés depuis le projet original, arborescence conservée.

## Objectif et périmètre livré

Internationalisation des **conventions de candidature**, distincte de l'internationalisation des menus de l'application. L'utilisateur peut choisir un pays de destination et une langue de document pour son CV et sa lettre. Les règles ne prétendent pas constituer un avis juridique ou des obligations universelles.

### Pays pris en charge

| Code | Pays | Langue indicative | Papier suggéré | Photo | Nature des références |
|---|---|---|---|---|---|
| GLOBAL | International | Langue du flux existant | A4 | À éviter par défaut | Recommandation éditoriale |
| CD | RDC | Français (modifiable) | A4 | Facultative | Recommandation éditoriale **à vérifier localement** |
| FR | France | Français | A4 | Facultative | Service-Public |
| CA | Canada | Anglais, français au choix | Letter | Déconseillée | Job Bank Canada, Québec |
| US | États-Unis | Anglais | Letter | Déconseillée | USAJOBS et guidance universitaire |
| GB | Royaume-Uni | Anglais | A4 | Déconseillée | National Careers Service |
| DE | Allemagne | Allemand | A4 | Facultative | Bundesagentur für Arbeit |

Ne pas utiliser ces recommandations pour inférer la nationalité, la religion, le sexe, l'âge, la résidence ou l'admissibilité professionnelle d'un candidat. En RDC, aucune source normative suffisamment spécifique n'a été intégrée : les conseils sont **explicitement éditoriaux**.

### Code ajouté

- `src/lib/career-localization/markets.ts` : politiques versionnées, références, langues prises en charge, résolution de langue, titres de sections, règles de rédaction IA, fallback sûr.
- `src/components/resumes/career-market-panel.tsx` : sélecteurs de marché/langue accessibles, conseils FR/EN et références ; aucune modification de contenu sans action.
- `scripts/career-localization.test.mjs` : cohérence et sécurité des règles.
- `scripts/career-localization-boundaries.test.mjs` : limites d'intégration, propriété des documents, protections contre les modifications silencieuses.
- `scripts/career-localization-docx.test.mjs` : ouverture des fichiers Word natifs et vérification des dimensions et titres internationaux.

### Modifications de modules préexistants

- Schémas `resume-editor.ts` et `cover-letter-editor.ts` : nouveaux champs `targetMarket`, `documentLanguage` (auto / fr / en / de) dans les JSON `design` existants ; `paper` pour la lettre.
- Studios CV et lettre : sélection explicite pays/langue, papier proposé, sauvegarde via les API PATCH existantes.
- Aperçu et rendu CV : pagination et tailles A4 / US Letter adaptées ; titres de sections français, anglais et allemand ; contenu du candidat intact.
- Exports PDF des deux types de documents : respect de `design.paper`.
- Export DOCX : langue de document prioritaire, libellés allemands, sélection A4 / US Letter.
- Assistants CV et lettres : politiques pays insérées dans les prompts système, job postings non fiables, aucune compétence inférée à partir d'une offre. Les pays/langues de la lettre ne peuvent pas être écrasés par une proposition IA.
- Création d'une lettre à partir d'un CV : héritage initial des préférences internationales du CV ; les lettres préexistantes conservent leurs propres réglages.
- `package.json` : `test:phase05` et ajout dans `test:cvcomet:baseline`.

## Compatibilité

**Aucune migration SQL/Prisma requise pour l'étape 05.** Les champs sont dans `Cv.design` et `CoverLetter.design` (JSON). Les anciens documents reçoivent des valeurs par défaut au moment de la normalisation (`GLOBAL`, `auto`, `A4`) et ne sont pas réécrits implicitement.

Changer le pays depuis l'interface propose et applique le format papier associé en même temps que le choix explicite. Changer uniquement la langue ne modifie ni les compétences, ni l'historique, ni les expériences. Les anciens paragraphes ne sont pas traduits automatiquement : une demande explicite à l'IA est nécessaire, avec prévisualisation/approbation conservées des étapes 03–04.

Les conseils sont un **point de départ** : une offre d'emploi, un concours, une administration, une école ou une profession peut imposer un format différent.

## Tests exécutés dans cet environnement

```bash
npm run test:phase05
npm run test:cvcomet:baseline
```

- **Phase 00 :** 25 tests réussis.
- **Étape 01 :** 14 tests réussis.
- **Étape 02 :** 12 tests réussis.
- **Étape 03 :** 14 tests réussis.
- **Étape 04 :** 19 tests réussis.
- **Étape 05 :** 13 tests réussis.
- **Total : 97/97 tests ciblés réussis** à la rédaction du rapport.
- Analyse de syntaxe TypeScript/TSX : 353 fichiers analysés, aucune erreur de syntaxe détectée (transpileModule). Ce contrôle ne vaut pas typecheck ni build complet.

### Vérifications obligatoires en préproduction

1. Sauvegarder la base de données, restaurer une copie de staging, puis exécuter les migrations cumulées des phases antérieures.
2. Installer les dépendances et exécuter `npx prisma generate`, `npm run typecheck`, `npm run build` et les tests d'intégration authentifiés.
3. Dans les studios, sélectionner CA/US/DE/FR/CD, sauvegarder, recharger et vérifier la persistance de `targetMarket` et `documentLanguage`.
4. Exporter PDF et DOCX en A4 et Letter, vérifier les marges, sauts de page, logos et en-têtes dans Word, LibreOffice ou un lecteur équivalent.
5. Faire générer une lettre de candidature et l'améliorer par l'IA ; comparer proposition avant/après, puis accepter ou refuser ; vérifier qu'aucune identité/faits non confirmés n'est créée.
6. Tester la convergence/concurrence des sauvegardes et des propositions IA sur deux onglets.
7. Faire relire les conventions de pays par des professionnels RH locaux, surtout pour CD, ainsi que pour les secteurs publics/spécialisés.

**Non vérifiés ici** : compilation TypeScript sémantique, build Next.js complet, migrations sur base réelle, rendus PDF dans un navigateur réel, fournisseurs IA et intégration des sessions authentifiées. Ne pas traiter l'étape 05 comme un feu vert pour la production.

## Sources de référence (consultées le 24 octobre 2026)

- France : https://www.service-public.fr/particuliers/vosdroits/F33336
- Canada : https://www.jobbank.gc.ca/findajob/resources/write-good-resume
- Québec : https://www.quebec.ca/en/employment/find-job-internship/tips/protecting-personal-information
- États-Unis : https://help.usajobs.gov/faq/application/documents/resume/what-to-include
- États-Unis (complément) : https://careercenter.ucdavis.edu/resumes-and-materials/resumes
- Royaume-Uni : https://nationalcareers.service.gov.uk/careers-advice/cv-sections
- Allemagne : https://www.arbeitsagentur.de/bildung/bewerbung/lebenslauf
- Allemagne (édition 2026) : https://www.arbeitsagentur.de/vor-ort/zav/working-and-living-in-germany/iss-en/issue-01-2026/application-cv

## Prochaine étape

**Étape 06 — Career Agent & Tool Calling :** orchestrateur d'outils avec permissions explicites, enveloppes typées, coûts plafonnés, audit, état et approbation ; aucun envoi de candidature sans consentement.
