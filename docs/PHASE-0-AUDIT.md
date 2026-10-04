# CVcomet — Audit et direction produit, phase 0

Date : 4 octobre 2026. Périmètre : dépôt local, 143 fichiers dans src, 31 fichiers de routes API et 18 migrations historiques. Rapport demandé par le cahier des charges joint ; aucune fonctionnalité métier ni migration n'est implémentée dans cette phase.

**Livrables visuels :** [maquette interactive](design/concept.html), [spécification du design](design/README.md). Les noms, documents et informations du prototype sont fictifs. Il ne se connecte ni à Prisma, ni à Stripe, ni aux fournisseurs IA.

## A. CURRENT ARCHITECTURE — Architecture constatée

| Domaine | Existant vérifié |
| --- | --- |
| Framework | Next.js 15.2.4, App Router dans src/app ; React installé 19.1.0, manifeste ^19.0.0 |
| Langage | TypeScript strict ; alias @/* vers src/* |
| Données | PostgreSQL, Prisma Client 6.5.0, singleton dans prisma/prisma.ts |
| Auth | Authentification maison email/mot de passe, bcryptjs, JWT jose 6.0.10 dans cookie httpOnly token_cv |
| Autorisation | src/lib/auth.ts : getSessionUser, canAccessUser, isAdmin ; middleware de navigation |
| État | Redux Toolkit et thunks Axios ; session dupliquée entre authSlice et userSlice |
| Interface | Tailwind 4, primitives Radix/shadcn locales, Lucide, Framer Motion |
| Formulaires | React Hook Form + Zod côté navigateur ; validation serveur partielle |
| Internationalisation | i18next, dictionnaires FR/EN chargés par HTTP ; détection cookie/HTML/localStorage |
| IA | Vercel AI SDK 4.2.10 et @ai-sdk/google 1.2.5 ; OpenAI configuré mais aucun appel métier trouvé |
| PDF | @react-pdf/renderer pour l'export ; aperçus HTML distincts des documents PDF |
| Paiement | Stripe Checkout, résiliation en fin de période, webhook signé |
| Observabilité | console, Google Analytics dans le layout ; pas de monitoring d'erreurs dédié trouvé |

Routes UI existantes : /, /login, /signup, /profil, /templates, /upgrade, /g/[id], /admin, /unauthorized. Aucun dossier pages, services, actions ou features dédié trouvé dans src ; aucune Server Action identifiée. Aucun parcours /dashboard, ATS, candidatures, entretiens ou portfolio n'est actuellement implémenté.

Le layout racine enveloppe aussi les pages de connexion avec la sidebar, le compte et les providers. Le contenu est limité par md:w-10/12. Les pages métier sont principalement des composants clients.

## B. EXISTING FEATURES — Fonctionnalités présentes et réutilisables

| Fonction | État réel | Réutilisation |
| --- | --- | --- |
| Compte | Inscription, connexion, déconnexion, JWT ; suppression utilisateur côté API | Garder les routes et sécuriser leurs contrats |
| Profil | Identité, coordonnées, compétences/langues texte ; CRUD expériences, formations, projets, certifications | Le User et ses relations constituent déjà la base du Career Profile |
| CV et lettres | Génération structurée avec streaming, historique de conversation, lecture/suppression de documents | Conserver API, schémas et données ; ajouter l'édition ensuite |
| Modèles | Galerie, aperçu, choix du modèle courant, plan FREE/PAID, upload admin de vignettes | Réutiliser les composants ; remplacer progressivement les identifiants codés en dur |
| PDF | Téléchargement via les composants React PDF existants | Protéger ce rendu des nouveaux styles de l'application |
| Abonnement | Gratuit/Premium, création de Checkout, webhook, annulation | Base à consolider, pas un billing complet |
| Administration | Listes utilisateurs/documents, création de modèles, changement du plan d'un modèle | Conserver les garde-fous ADMIN |

Pas d'éditeur de CV section par section, autosave, undo/redo, import de CV, export DOCX, analyse ATS réelle, score de match, suivi de candidature, entretien IA ou portfolio trouvé. L'expression « ATS-optimized » dans les prompts ne constitue pas un analyseur ATS.

## C. EXISTING AI ARCHITECTURE — Fonctionnement exact

1. La page / appelle POST /api/conversations via Redux avec l'offre saisie.
2. Cette route valide content et userId avec Zod, vérifie la session/propriété, appelle generateText pour créer un titre, puis enregistre Conversation.
3. /g/[id] utilise experimental_useObject de @ai-sdk/react et cvSchema/coverLetterSchema.
4. Les routes generate-cv et generate-cover-letter revérifient l'accès à la conversation, lisent le profil et ses quatre relations depuis Prisma et retirent password.
5. Pour un utilisateur gratuit, elles lisent generationCount/lastGeneratedAt et appliquent dayLimit = 20.
6. Elles enregistrent le message utilisateur, chargent l'historique et construisent les prompts définis dans src/helpers/helpers.tsx.
7. streamObject utilise le client src/lib/gemini.ts, le modèle codé en dur gemini-1.5-flash et les schémas Zod.
8. onFinish enregistre le message assistant puis le Cv ou CoverLetter. toTextStreamResponse alimente l'aperçu client.

**Blocage fournisseur :** les trois appels (titre, CV, lettre) utilisent gemini-1.5-flash. Google indique que ce modèle a été arrêté le 29 septembre 2025. C'est confirmé par le [changelog officiel Gemini](https://ai.google.dev/gemini-api/docs/changelog#september-29-2025), pas par un appel aux clés du projet. Prévoir une sélection configurable d'un modèle disponible et un test de compatibilité des sorties structurées avant tout changement.

**Problème de fidélité :** les prompts demandent explicitement de compléter des informations absentes, d'ajouter des compétences non déclarées, une langue « Fluent » non déclarée et certaines certifications manquantes. Voir src/helpers/helpers.tsx, notamment les lignes 31, 99, 115 et 135. Cela contredit le cahier des charges. La prochaine évolution IA doit supprimer ces consignes, accepter les champs inconnus et présenter des propositions vérifiables avant enregistrement.

Autres points :
- Le dernier message est enregistré puis relu dans l'historique, auquel un prompt reprenant la même description est ajouté : contexte redondant.
- L'offre initiale et le profil complet sont renvoyés à chaque génération ; historique sans fenêtre de taille.
- Le DTO IA est un User débarrassé du mot de passe, mais conserve des champs de rôle, quota et facturation inutiles.
- Le compteur est incrémenté avant la réussite ; vérification et incrément ne sont pas atomiques. Deux requêtes concurrentes peuvent franchir une limite.
- La génération du titre ajoute coût et latence, n'utilise pas le quota commun et bloque la création de conversation si le provider échoue.
- Aucune journalisation structurée de tokens/coût par fonction, aucun rate limiter dédié ni stratégie de retries bornée trouvé.
- Les requêtes de génération ne valident pas leur corps avec Zod, contrairement à la création de conversation.
- L'offre est interpolée dans un texte d'instructions ; les limites entre données non fiables et instructions doivent être explicites.
- Les deux écritures onFinish ne sont pas transactionnelles. Une erreur de persistance après émission du flux doit être rendue visible.
- Aucun nouvel appel IA n'a été effectué pendant l'audit.

## D. DATABASE — Schéma actuel

Dix modèles : User, Conversation, Experience, Education, Certification, Project, Cv, CoverLetter, Template, Message.

Relations principales :

```text
User ── Experience / Education / Project / Certification
  └── Conversation ── Cv / CoverLetter / Message
Template ── Cv / CoverLetter
User ── modèle CV courant / modèle lettre courant
```

Observations :
- Cv et CoverLetter appartiennent à l'utilisateur via Conversation. Ne pas créer un second modèle Resume avec les mêmes données.
- User contient déjà une grande partie du profil carrière ; CareerProfile peut commencer comme un DTO agrégé.
- Cv stocke des instantanés JSON par section ; summary est String[] alors que le schéma IA produit une chaîne.
- Le schéma IA Cv contient hobbies mais la route ne le persiste pas. La date structurée d'une lettre n'est pas persistée non plus.
- Les dates des expériences/formations sont des chaînes ; ne pas les convertir sans stratégie pour les valeurs incomplètes.
- Template.templateFile contient un binaire de vignette, pas une définition dynamique de mise en page. Le renderer dépend d'UUID dans src/helpers/constants.tsx.
- Seul User.email a un index unique explicite hors clés primaires ; pas de @@index sur userId ou conversationId malgré les filtres.
- Les informations Stripe se limitent à isSubscribed, subscriptionId et stripeCustomerId dans User.
- Des migrations historiques comportent des DROP de colonnes/tables. Elles ne doivent pas être rejouées sur une base existante sans contrôle d'état.
- Aucun accès au contenu de la base ni contrôle de dérive du schéma distant n'a été effectué.

## E. UI/UX AUDIT — Constats et conséquences

| Constat dans le code | Conséquence | Direction proposée |
| --- | --- | --- |
| Fond #282828 et sidebar #1a1a1a imposés, textes gris/blanc codés en dur | Mode clair impossible sans reprise cohérente | Tokens sémantiques clair/sombre |
| Deux jeux de variables sidebar, OKLCH puis valeurs HSL sans fonction | Couleurs concurrentes ou invalides selon usage | Une seule définition sémantique par thème |
| Variables Geist déclarées sans police initialisée | Typographie effective non maîtrisée | Police système soignée pour la première étape, puis fonte locale vérifiée |
| Header de 40 px, titre d'accueil text-xl, grande zone min-h-[90vh] | Faible hiérarchie et espace peu utile | Header de 68 px, titre 36 px, contenu structuré par actions |
| Sidebar sans état actif explicite ni séparation des domaines | Orientation difficile | Navigation hiérarchisée, item actif, drawer mobile |
| Galerie : images object-fill, hauteur fixe 350 px | CV déformés, détails masqués | Ratio A4, object-contain et pied de carte lisible |
| Galerie vide sans message explicite ni relance d'erreur | Page perçue comme cassée | EmptyState, skeleton et Retry distincts |
| motion.div cliquable sans bouton ; fermeture modale avec div « X » | Accès clavier et restitution vocale incomplets | Boutons sémantiques et Dialog Radix |
| popupModal sans piège de focus/aria-dialog ; user! non garanti | Risque d'accessibilité et erreur si profil non chargé | Dialog contrôlé et états de session explicites |
| Accueil et génération utilisent contentEditable | Saisie/validation et clavier difficiles à maîtriser | Textarea contrôlé avec libellé |
| Profil long cumulant listes et formulaires | Charge visuelle et faible guidage | Navigation par sections, résumé de complétude et sauvegarde explicite |
| Montages répétés de useCurrentUser | Plusieurs appels /api/me depuis header/sidebar/pages | Hydratation de session commune, déduplication |
| /profil relit les collections déjà incluses par fetchUser | Appels API et états Redux redondants | Un chargement de profil agrégé |
| FR/EN mêlés dans les pages ; label html lang absent | Localisation et accessibilité incomplètes | Réutiliser les dictionnaires pour tout nouveau texte |
| next-themes installé mais aucun ThemeProvider trouvé | Thème non piloté ; Toaster seul consomme useTheme | Installer le provider dans la structure existante |
| Animations Framer sans gestion locale de reduced-motion | Animations imposées | Respect de prefers-reduced-motion |
| UUID de modèles et URL de production dans constants | Portabilité difficile entre environnements | Clés de renderer stables et URL de configuration |

Ces observations proviennent du code. Aucun audit WCAG intégral, mesure Lighthouse ou test visuel connecté aux données réelles n'est revendiqué.

## F. TECHNICAL DEBT — Priorités

### Critical — Bloquants avant nouveaux appels IA / exposition publique

- **Modèle Gemini arrêté** : titres, CV et lettres dépendent du même identifiant obsolète. Définir et vérifier le remplacement.
- **Secret JWT de secours prévisible** : src/lib/utils.ts utilise « secret_key » si JWT_SECRET manque. Risque de falsification de session dans cet état de configuration ; échouer explicitement côté serveur. L'audit ne conclut pas que le secret manque dans l'environnement actuel.
- **Fabrication de données professionnelles** explicitement encouragée par les prompts. Corriger avant d'étendre l'assistance IA.

### High — À traiter au début de l'implémentation

- **Réponse utilisateur trop large** : les routes updateTemplate/updateCoverLetter retournent le User brut après update, donc aussi le hash password et les champs Stripe. Utiliser select ou un DTO minimal.
- **Droits premium uniquement dans la modale** : ces mêmes routes vérifient la propriété, mais pas le plan du template, son type, ni l'abonnement. Vérifier les droits côté serveur.
- **Validation serveur incomplète** : login/signup, CRUD profil, génération et Stripe acceptent des corps non validés de manière exhaustive.
- **Session périmée/révocation** : /api/me et getSessionUser valident le JWT sans contrôler l'existence actuelle du compte ni la révocation du rôle. Le JWT contient un rôle valable jusqu'à expiration.
- **Quotas concurrents et titre sans quota**, absence de rate limiter sur login/signup/génération.
- **Stripe** : priceId est fourni par le navigateur sans catalogue serveur ; aucun journal d'événements traité/idempotence ; webhook ne réconcilie pas le cycle complet des factures et restaurations d'abonnement.
- **Suppression de compte** : suppression locale transactionnelle présente, mais pas d'annulation Stripe ni de révocation explicite du cookie dans cette route.
- **TypeScript échoue** : propriété modal de src/app/layout.tsx sans slot @modal présent. L'erreur remonte dans .next/types/app/layout.ts:34.

### Medium — Qualité et performance

- Upload de vignettes admin sans taille/MIME validés côté serveur ; réponse d'erreur interne exposée. /api/avatar est public et force image/png : clarifier ce contrat.
- GET /api/templates lit et sérialise les binaires de toutes les vignettes, ensuite relues via /api/avatar ; séparer métadonnées et image, ajouter cache adapté.
- Requêtes séquentielles et résultats non paginés sur plusieurs listes ; conversations limitées à 20 sans curseur.
- Enregistrement de la génération sans transaction ; pas d'édition ou versions de Cv.
- PDF : second object URL créé dans downloadPdf.ts non révoqué ; aller-retour fetch(blobURL) inutile ; erreurs seulement en console.
- Aperçus HTML et PDF dupliqués : toute refonte des templates doit vérifier les deux rendus.
- 46 avertissements no-explicit-any ; schémas Zod et types manuels de CV/lettre divergents.
- Accueil lance le thunk sans unwrap ni état d'échec clair ; certaines modales attendent un thunk sans unwrap et leur catch ne capture donc pas les rejets métier.
- Canonical global partagé ; sitemap inclut /templates et /upgrade protégés ; robots ne bloque que /admin. Prévoir noindex pour les espaces privés.
- Pas de tests automatisés ou script test identifié ; pas de configuration CI trouvée.

### Low — Entretien

- Imports/variables inutilisés, logs de debug, noms comme More, curentLanguage, templeteForm.
- README resté celui du scaffold Next.js ; configuration réelle non documentée.
- Dépendances PDF alternatives présentes sans chemin d'export actif identifié ; vérifier leurs usages avant nettoyage.

**Ce qui existe déjà en sécurité :** vérification de propriété sur les CRUD examinés et les générations, garde ADMIN pour les collections globales et mutations de templates, bcrypt, cookie httpOnly/SameSite, signature Stripe sur le corps brut, suppression transactionnelle des conversations. Il serait inexact de décrire toutes les API comme publiques.

**Vérifications effectuées :**

| Contrôle | Résultat |
| --- | --- |
| TypeScript, tsc --noEmit --incremental false | Échec : 1 erreur sur modal du layout |
| ESLint direct, 147 fichiers | 1 erreur no-var dans prisma/prisma.ts:5 ; 139 avertissements |
| Tests existants | Aucun fichier .test/.spec ni runner configuré trouvé |
| Build production | Non relancé : les contrôles statiques ont déjà des blocages ; aucune source applicative modifiée dans cette phase |
| Base/Stripe/IA réels | Aucun appel métier, paiement, import ou migration lancé |

L'erreur no-var porte sur la déclaration globale du singleton Prisma : corriger précisément la règle ou sa portée, sans remplacer mécaniquement la déclaration par let. La correction JWT d'expiration du travail précédent reste présente.

## G. TARGET ARCHITECTURE — Évolution compatible

Garder App Router, Redux, Prisma, Radix, Zod, les adaptateurs IA et les routes existantes.

- Extraire progressivement AppShell, AppHeader et navigation de domaine ; utiliser les tokens dans les primitives existantes.
- Distinguer à terme layouts public/auth/privé à l'aide de route groups, qui ne changent pas les URL.
- Un seul chemin de session ; garder canAccessUser/isAdmin et les renforcer côté serveur.
- CareerProfile = DTO de User + relations existantes, avec mapping explicite vers les sections du CV.
- Étendre Cv, CoverLetter et Template ; ne pas introduire de modèles concurrents sans besoin.
- Les Route Handlers gardent auth/validation/réponse ; de petits services de domaine ne sont extraits que quand de la logique doit réellement être partagée.
- Réutiliser src/lib/gemini.ts et src/lib/openai.ts ; mutualiser configuration du modèle, contexte minimal, quotas, validation et erreurs. Conserver les prompts spécialisés.
- Contrats de données dérivés de Zod, renderer de document distinct du chrome applicatif.
- Actions IA proposées avant acceptation ; version sauvegardée avant remplacement.
- Feature entitlements centralisés côté serveur ; le frontend les consomme pour l'affichage.
- Les nouvelles routes /dashboard/* sont ajoutées quand les fonctions sont implémentées. Les anciennes URL restent valides.
- Ne pas afficher de score ATS, match, revenus ou témoignages fictifs dans le produit. Les fonctions futures restent masquées ou explicitement non disponibles.

## H. DATABASE EVOLUTION — Changements proposés, non exécutés

| Moment | Évolution minimale | Transition |
| --- | --- | --- |
| Phase 1 | Aucune table CareerProfile nécessaire ; éventuellement préférences thème/langue/onboarding dans un second lot | DTO sur User ; paramètres facultatifs |
| Phase 2 | Cv.updatedAt, configuration de sections, brouillon, CvVersion, Template.rendererKey unique nullable au départ | Backfill des clés à partir des mappings actuels, compatibilité de lecture, puis contraintes |
| Phase 3 | ATSAnalysis : cvId, version analysée, score estimatif, résultat validé JSON, version d'algorithme | Nouveau modèle, anciens CV intacts |
| Phase 4 | Job + JobMatch liant User/Cv/version ; exigences extraites et compétences non vérifiées | Nouveau modèle, zéro modification silencieuse de profil |
| Phase 5 | Relier CoverLetter à Job/Cv facultativement ; brouillon email si besoin de persistance | Relations optionnelles, conserver Conversation |
| Phase 6 | Application : propriétaire, offre, statut, document/version, dates, contact, notes | Statuts contrôlés, index selon requêtes ; pas de copies des CV |
| Phase 7 | InterviewSession + InterviewMessage avec propriétaire et contexte sélectionné | Historique et politique de conservation explicites |
| Phase 9 | Subscription, StripeEvent avec eventId unique, AIUsage et réservations de quota | Réconcilier les identifiants Stripe avant bascule de isSubscribed |
| Phase 11 | slug public unique facultatif et réglage de visibilité du portfolio | Privé par défaut, DTO public minimal |

Index à envisager après validation des requêtes : Conversation(userId, createdAt), Message(conversationId, createdAt), Cv(conversationId, createdAt), CoverLetter(conversationId, createdAt), userId sur les collections du profil. Les coûts d'index doivent être vérifiés sur une base de test.

Procédure : sauvegarde + base de test, état des migrations, ajout nullable, backfill contrôlé, double lecture temporaire, vérification des comptes/relation, seulement ensuite contrainte. Pas de reset, renommage destructif ou suppression de colonne dans les premières phases.

## I. DESIGN SYSTEM — Direction proposée

**Identité : un atelier de carrière calme, précis et éditorial.** Ivoire, encre, vert profond ; document blanc au centre, espace généreux, typographie lisible. Le vert identifie l'action de marque ; un succès exige aussi texte/icône, pour éviter la confusion.

Les tokens, dimensions, contrastes, interactions et états sont décrits dans [design/README.md](design/README.md). La maquette illustre l'accueil, la galerie et le profil, en clair/sombre et mobile. Les modules futurs ne prétendent pas fonctionner.

Principes :
- Une action prioritaire par bloc, une grille utile, peu d'ornements.
- Aperçus de documents au ratio A4, jamais déformés.
- Progression du profil calculée sur les champs complétés ; aucun score ATS décoratif.
- Galerie avec recherche, catégories, type de document, sélection et aperçu.
- Profil en sections et aperçu ; feedback de sauvegarde explicite.
- Navigation clavier, dialogue accessible, focus visible, cibles tactiles confortables.
- État vide conçu dès le départ ; squelette, erreur et contenu distincts.
- FR et EN via la couche i18n existante à l'intégration ; la maquette de direction est en français.

## J. IMPLEMENTATION ROADMAP — Lots vérifiables

Tous les chemins nouveaux ci-dessous sont des propositions, pas des fichiers supposés déjà présents.

| Lot | Objectif et fichiers concernés | Dépendances | DB | Risque | Acceptation |
| --- | --- | --- | --- | --- | --- |
| 0 | Audit, tokens et maquette dans docs/ | Dépôt inspecté | Non | Faible | Source de chaque risque, maquette desktop/mobile |
| 1.0 | Petit socle visuel : globals.css, layout.tsx, nouveau ThemeProvider | 0 | Non | Moyen : styles hérités | Thèmes cohérents, layout typé, rendu PDF inchangé |
| 1.1 | AppShell, app-sidebar, accountNav, dictionnaires FR/EN | 1.0 | Non | Moyen : auth/layout | Item actif, collapse/drawer, clavier, URL intactes |
| 1.2 | Accueil et profil : page.tsx, profil/page.tsx, forms, userSlice, useCurrentUser | 1.1 + session dédupliquée | Non | Moyen : état Redux | Données réelles, pas de double fetch, erreurs et vide |
| 1.S | Corriger secret de secours, DTO, droits premium et schémas serveur ; lib/auth, API user/template/auth | 0, avant mise en production | Non initialement | Élevé : auth | 401/403 testés, aucun hash renvoyé, prix/plan contrôlés |
| 2.0 | Types de document et registre des renderers ; helpers/schema, constants, templates | 1 | Ajouts Template/Cv | Moyen : anciens IDs | Changement de modèle sans perte, anciens liens valides |
| 2.1 | Éditeur de sections, aperçu, autosave débouncé, undo/redo ; nouveaux composants d'édition et API Cv PUT | 2.0 | CvVersion | Élevé : contenu | Sauvegarde vérifiée, conflit visible, restauration, mobile |
| 2.2 | Assistance contextuelle factuelle ; helpers/helpers, lib/gemini, routes génération | Provider remplacé/testé + 1.S | Versions/usage | Élevé : IA | Champs inconnus préservés, diff et acceptation, quota atomique |
| 2.3 | Export PDF et contrôle de pagination ; lib/downloadPdf et composants React PDF | 2.1 | Non | Moyen : rendu | A4 multipage, pas de texte coupé, liens et accents |
| 3.1 | Import sécurisé et extraction avec confirmation ; nouveaux parsing/schema/API | 1.S + 2 | Métadonnées si besoin | Élevé : fichiers | Taille/type bornés, aperçu, incertitude signalée |
| 3.2 | ATS estimatif, recommandations typées, corrections acceptées | 3.1 + 2.2 | ATSAnalysis | Moyen | Score expliqué et versionné, aucune promesse ATS propriétaire |
| 4.1 | Parser d'offre, job match et compétences non vérifiées | 2.2 | Job/JobMatch | Moyen | Comparaison factuelle, pas d'ajout automatique |
| 4.2 | Adaptation CV avec diff et version | 4.1 + 2.1 | Réutilise CvVersion | Élevé | Accepter/rejeter chaque modification, restauration |
| 5 | Édition lettre et email ; cover-letter existant + composants dédiés | 2.2 + 4 | Relations optionnelles | Moyen | Copier/éditer/exporter, erreurs et langue cohérentes |
| 6 | Candidatures, CRUD, Kanban/table, filtres ; nouveaux domaine/API/pages | 4 + 5 | Application | Moyen | Propriété vérifiée, statuts persistés, pagination |
| 7 | Entraînement entretien, question/réponse/feedback structuré | 6 + quotas | InterviewSession/Message | Moyen | Un tour à la fois, feedback expliqué, aucune psychométrie |
| 8 | Assistant transversal via contexte autorisé minimal | 2–7 | Réutiliser Conversation si adapté | Élevé | Aucun accès croisé, actions avec confirmation de contenu |
| 9 | Catalogue serveur, Checkout/Portal, webhooks idempotents, droits/quota ; routes Stripe, nouveaux lib/billing | 1.S ; consolider paiements tôt | Subscription/StripeEvent/AIUsage | Élevé | Replay webhook sans double effet, factures/annulation/réactivation |
| 10 | Analytics utiles issus d'événements réels | 3–9 | Agrégations, pas de duplication initiale | Faible | Aucun chiffre inventé, filtres date et état vide |
| 11 | Portfolio public opt-in et SEO | Profil stable | Slug/visibilité | Moyen : confidentialité | Privé par défaut, aperçu, seules données autorisées exposées |
| 12 | Landing/pricing/public SEO, séparation des layouts | Shell stable + catalogue réel | Non | Moyen : navigation | CTA fonctionnels, prix réels, aucun faux témoignage |
| 13 | QA, sécurité, accessibilité, performance ; tests/CI proposés | Contrôles menés à chaque lot | Selon corrections | Moyen | tsc/lint/build, tests auth/quotas/Stripe et E2E essentiels |

Les phases sécurité/quotas/abonnement ne doivent pas être reportées à la fin si un parcours qui en dépend est livré auparavant. Une phase est terminée uniquement quand ses critères et contrôles passent ; ce rapport n'annonce pas ces fonctionnalités comme réalisées.

## K. FIRST IMPLEMENTATION STEP — Première petite étape exacte

**Installer les fondations de thème, sans modifier les API :**

1. Retirer la prop modal du layout racine puisqu'aucun slot @modal n'existe.
2. Ajouter un petit provider next-themes avec la dépendance déjà installée.
3. Unifier les tokens dans globals.css, définir la typographie et le focus ; éliminer le deuxième jeu sidebar incompatible.
4. Brancher uniquement le fond et la couleur de texte du shell sur ces tokens, puis tester le thème sur les pages existantes avant de les convertir.
5. Ajouter un bouton de thème accessible dans le header ; ne pas modifier les styles internes des documents PDF.
6. Vérifier tsc, le lint ciblé, login/profil/templates et largeur 390/768/1440 px ; documenter les erreurs héritées séparément.

Aucune modification Prisma. Risque principal : anciens text-white/bg fixes qui deviennent illisibles en clair ; convertir chaque écran avec son fond dans le même lot ou conserver temporairement son thème sombre. Ne pas activer une moitié de thème clair.

C'est la première étape proposée après cette phase 0. Le layout, l'auth, les API et les données applicatives n'ont pas été modifiés pendant l'audit.
