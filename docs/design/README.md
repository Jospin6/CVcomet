# CVcomet — Direction visuelle

Cette maquette accompagne la phase 0 du cahier des charges. Elle matérialise une direction de design avant l'intégration dans Next.js.

## Voir la proposition

Ouvrir [concept.html](concept.html) dans un navigateur moderne. Les fichiers HTML, CSS et JS doivent rester ensemble. Aucun téléchargement de police, script CDN ou service externe n'est nécessaire.

Captures :
- [Accueil, ordinateur](overview-desktop.png)
- [Galerie de modèles, ordinateur](templates-desktop.png)
- [Accueil, thème sombre](overview-dark.png)
- [Accueil, mobile](overview-mobile.png)
- [Galerie, mobile](templates-mobile.png)

Le rapport A–K, les constats de sécurité et la roadmap sont dans [PHASE-0-AUDIT.md](../PHASE-0-AUDIT.md).

## Intention

Un atelier de carrière calme et précis : l'utilisateur retrouve son parcours, construit ses documents et sait quelle est la prochaine action utile.

L'identité associe un fond ivoire, un vert forêt, une typographie sobre et des documents blancs. La couleur guide les actions et la sélection. Les bordures fines séparent les contenus ; les ombres sont réservées aux documents et aux dialogues. Pas de faux témoignage, de faux score ATS ou de métrique marketing.

La grille respecte la lecture : navigation persistante, barre de contexte, titre de page, action prioritaire, puis contenu. Les modèles de CV ont leur propre langage graphique et gardent un fond blanc même lorsque l'application passe en thème sombre.

## Palette et tokens proposés

| Rôle | Clair | Sombre | Usage |
| --- | --- | --- | --- |
| canvas | #F8F9F6 | #171D1A | Fond de l'espace |
| surface | #FFFFFF | #1E2621 | Navigation, formulaires et panneaux |
| surface-soft | #F0F2ED | #263029 | Surface secondaire |
| ink | #222B27 | #ECF1EA | Texte principal |
| muted | #65716A | #B3BEB5 | Description et aide |
| faint | #6D7871 | #A4B2A7 | Métadonnées secondaires |
| border | #E2E7DF | #344139 | Séparateurs décoratifs |
| brand | #285446 | #B6D3A7 | Action principale et sélection |
| on-brand | #FFFFFF | #17291C | Texte de l'action principale |
| brand-soft | #EAF0E9 | #2B3C30 | Navigation active |
| hero | #EAF0E7 | #263D2E | Introduction éditoriale |
| focus | #32785D | #BBDDA9 | Contour de focus |

À l'intégration, mapper ces rôles sur les variables sémantiques déjà présentes dans globals.css : background, foreground, card, primary, muted, border, ring, sidebar. Éviter une seconde famille de tokens concurrente.

États métier à ajouter aux tokens existants : succès vert avec texte/icône, attente amber, erreur rouge. Ne pas distinguer un statut par la couleur seule. Les bordures décoratives ne sont pas les seuls indicateurs d'un contrôle ; prévoir un contraste adapté pour les limites des champs interactifs pendant l'audit d'accessibilité d'intégration.

## Typographie et rythme

Première étape sans dépendance : police système « Segoe UI Variable », « Segoe UI », -apple-system, BlinkMacSystemFont, sans-serif. Le téléchargement d'une nouvelle fonte ne doit pas bloquer le rendu.

| Niveau | Cible |
| --- | --- |
| Titre de page | 36–38 px desktop, 28–30 px mobile, poids 600, interligne 1.2 |
| Titre de section | 19–21 px, poids 600 |
| Corps | 13–14 px, interligne 1.55–1.8 |
| Navigation, formulaire, bouton | 12–14 px |
| Métadonnées | 10–12 px ; capitales espacées utilisées avec parcimonie |

L'échelle miniature à l'intérieur des aperçus A4 est distincte de celle de l'interface. Elle représente un document réduit, jamais un champ à lire ou modifier directement.

Base d'espacement : 4, 8, 12, 16, 24, 32, 40, 48 px. Rayons : 6–8 px pour les contrôles, 10–12 px pour les panneaux, 15 px pour les dialogues. Pas de changement d'échelle de carte au survol ; légère translation du document seulement.

Sidebar : environ 238 px. Header : 70 px desktop / 62 px mobile. Largeur du contenu bornée ; trois colonnes pour les modèles, deux sur tablette, une sur petit mobile. Le profil passe de navigation latérale + formulaire à une lecture verticale.

## Trois vues à intégrer progressivement

### Accueil

- Salutation et explication brève.
- Une action prioritaire pour créer le premier document.
- Complétude du profil calculée sur les informations réelles disponibles ; dans la maquette, six champs déterminent le pourcentage.
- Raccourcis CV, lettre et profil.
- Documents récents ou état vide actionnable.
- Aucun graphique de carrière sans données capables de le justifier.

L'intégration doit préserver l'accès à la saisie d'offre et au flux de génération existants. Le dashboard enrichit l'accueil ; il ne supprime pas ce parcours.

### Galerie de modèles

- CV et lettres séparés par un contrôle explicite.
- Recherche par nom, filtres de style, tri et compteur de résultats.
- Cartes au ratio de document respecté, sélection lisible, aperçu accessible au clavier.
- Fenêtre d'aperçu avec information utile et essai de couleur.
- Aucun rendu de CV déformé par object-fill.
- Les noms et styles « Clarté », « Équilibre », etc. sont des propositions, pas les enregistrements de la base actuelle.

L'accès à un modèle payant doit être vérifié côté API avant de brancher la sélection réelle. La présence du bouton de sélection dans ce prototype ne constitue pas un droit d'accès premium.

### Profil carrière

- Sections courtes, titres descriptifs, libellés persistants.
- Données réelles et champs facultatifs clairement distingués.
- Message d'état près de la sauvegarde, sans faux autosave.
- Reprendre les formulaires Experience/Education/Project/Certification existants dans les étapes suivantes.
- Conserver User et ses relations comme source initiale du profil.

## Interactions de la maquette

- Navigation entre accueil, modèles et profil.
- Thème clair/sombre ; seule cette préférence visuelle est mémorisée localement.
- Recherche, catégories, tri et bascule CV/lettre.
- Ouverture d'un aperçu, essai de couleur, sélection locale d'un modèle.
- Profil modifiable pour la visite et progression recalculée.
- Sélecteur « Nouveau compte » pour montrer le vrai état vide de la proposition.
- Accès rapide : Ctrl+K / Cmd+K ; recherche, flèches, Entrée, Échap.
- Drawer mobile : fond inactif, focus contenu dans la navigation, fermeture par Échap.
- Dialogues natifs avec titre accessible, fermeture et retour de focus.
- Animation courte ; prefers-reduced-motion respecté.

Les personnes, postes, organisations et documents sont fictifs. Aucun appel IA, accès aux comptes, paiement ou écriture de données applicatives. Les modules futurs désactivés dans la navigation matérialisent la roadmap ; en production, masquer ceux qui ne sont pas utiles au parcours livré.

## États à livrer dans l'application

Chaque écran doit avoir son état chargé, chargement, vide, erreur et accès interdit lorsque pertinent. Les changements de modèle ou de contenu doivent attendre la confirmation de l'API ou offrir un rollback.

- Chargement : squelette aux mêmes dimensions que le contenu.
- Erreur : explication utile + nouvelle tentative, sans perdre la saisie.
- Sauvegarde : modifications en cours / enregistré / échec explicite.
- IA : activité réelle du flux, aucun faux pourcentage de progression.
- Donnée manquante : demande d'information, jamais invention.
- Fonction payante : plan et limites réels issus du catalogue serveur.

Les textes de l'application seront extraits dans public/locales/fr/common.json et en/common.json. Ce prototype de direction est volontairement en français.

## Vérifications réalisées

Les résultats détaillés sont dans [verification.json](verification.json).

- Chrome headless, profils de navigateur temporaires distincts du profil personnel.
- Trois écrans contrôlés à 390, 768 et 1440 px : aucun débordement horizontal détecté.
- Recherche et filtres, zéro résultat, réinitialisation, lettres, aperçu, couleur et sélection locale.
- Command palette, formulaire, progression, nouveau compte et thème sombre.
- Navigation mobile et fermeture Échap.
- Aucun bouton sans nom accessible détecté ; aucune exception JavaScript pendant le parcours testé.
- Six paires de contrastes principaux calculées : de 5.09:1 à 14.94:1, supérieures à 4.5:1.
- Lecture visuelle des captures desktop, galerie, mobile et sombre.

Ce contrôle ciblé n'est pas un audit WCAG complet ni un test E2E de l'application Next.js. Le ratio de contraste des textes principaux ne certifie pas à lui seul tous les composants, focus, états et contenus.

Le projet existant présente indépendamment une erreur TypeScript sur modal du layout, une erreur ESLint et 139 avertissements ; ils sont détaillés dans l'audit. La maquette n'a pas modifié ces sources.

## Première intégration proposée

Lot 1.0 : supprimer la prop modal sans slot existant, unifier les tokens, ajouter ThemeProvider avec next-themes déjà installé et un contrôle de thème. Puis convertir un écran complet avec son fond, ses textes et ses états pour éviter une interface moitié claire/moitié sombre.

Fichiers concernés : src/app/layout.tsx, src/app/globals.css, un petit composant provider et le header existant. Aucune migration Prisma, aucun changement des données ou des contrats API. Les rendus PDF doivent rester indépendants du thème de l'application.
