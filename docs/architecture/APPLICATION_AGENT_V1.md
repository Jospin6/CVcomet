# Application Agent v1 — CVComet 2.0, étape 09

## Portée réelle

Un dossier de candidature est un artefact durable privé du candidat. Il associe une offre, un CV versionné, une lettre facultative (versionnée), un brouillon d’email révisable, une langue et éventuellement une mission. **Aucun endpoint de cette étape n’envoie des emails, ne remplit des formulaires tiers ni ne soumet des candidatures.** Le statut `READY` signifie uniquement *validé par le candidat pour une utilisation manuelle* ; il ne correspond jamais au statut métier `APPLIED` du Job Tracker.

## Architecture

- Tables : `CareerApplicationPacket`, enum `CareerApplicationPacketStatus` (`DRAFT`, `READY`, `CANCELED`). Relations possédées par utilisateur ; les données sont conservées en PostgreSQL. Pas de stockage global ni de contenu email ouvert à l'agent IA.
- Création : clé de requête UUID et empreinte déterministe de l'intention. Même clé / même intention : même dossier ; clé réutilisée avec une intention différente : conflit 409. La clé est réutilisée lors d'une tentative réseau réitérée dans l'UI.
- Provenance : `jobId` doit appartenir à l'utilisateur ; `cvId` et `coverLetterId` doivent être accessibles via ses propres conversations. Si une lettre est liée à un CV ou à une offre différente, la création échoue. La mission facultative doit être active et appartenir au même compte.
- Brouillon initial : modèle déterministe FR/EN, sans déclaration d'expérience ou de compétences, sans prétendre que les fichiers ont déjà été joints ou envoyés. Le destinataire est facultatif et jamais inventé.
- Génération IA facultative sur action distincte : relit les faits `CONFIRMED` uniquement, applique les quotas existants et une validation conservatrice des nombres et techniques, puis **retourne une suggestion non sauvegardée**. L'utilisateur doit relire et enregistrer explicitement sa version ; la vérification factuelle automatique reste imparfaite.
- Edition : `PATCH` exige la révision courante et `DRAFT`. L'approbation utilise un compare-and-swap sous transaction sérialisable avec relecture des révisions CV/lettre/offre. Un dossier obsolète doit être recréé ; `READY` est non modifiable. L'UI affiche si ses sources ont évolué depuis l'approbation.
- Suppression : suppression volontaire du dossier par son propriétaire. La suppression de l'offre/CV/lettre liée purge également le dossier pour éviter d'afficher un dossier avec des pièces manquantes. La suppression d'une mission ne supprime pas automatiquement le dossier ; son rattachement devient nul.
- Career Agent : outil `list_my_application_packets`, en lecture seule, limité à 30 lignes. Ne renvoie que titre de poste, entreprise, statut, date d'approbation et identifiant ; jamais le texte de l'email ni l'adresse de destinataire.

## API HTTP versionnée

Réponses sous enveloppe `{apiVersion:"v1",requestId,data}` et échecs `{apiVersion:"v1",requestId,error:{code}}` :

| Opération | Endpoint | Effet |
|---|---|---|
| GET | `/api/career/v1/application-packets/options` | Liste filtrée des offres, CV, lettres et missions appartenant au compte |
| GET | `/api/career/v1/application-packets?limit=30` | Liste bornée des dossiers, max. 50 |
| POST | `/api/career/v1/application-packets` | Création idempotente ; `apiVersion,requestKey,jobId,cvId,coverLetterId?,missionId?,language` |
| GET | `/api/career/v1/application-packets/{id}` | Dossier privé, y compris les brouillons et drapeau de sources obsolètes |
| PATCH | `/api/career/v1/application-packets/{id}` | Modification après verrou CAS ; `apiVersion,revision,subject,body,recipientEmail?` |
| POST | `/api/career/v1/application-packets/{id}/suggest-email` | Suggestion IA après déclenchement utilisateur ; non enregistrée |
| POST | `/api/career/v1/application-packets/{id}/decision` | `apiVersion,revision,action:approve|cancel,reviewed:boolean` ; aucun envoi |
| DELETE | `/api/career/v1/application-packets/{id}` | Suppression volontaire du dossier |

## Invariants Zero Trust

- Identité exclusivement dérivée de la session serveur ; jamais `userId` transmis dans les bodies.
- Filtrage systématique en SQL avec `userId: actor.id`. `isAdmin` ne contourne pas ces règles.
- Toutes les mutations imposent contrôle d'origine et JSON borné ; aucun accès réseau à l'entreprise n'est appelé.
- Pas d'appels IA spontanés, pas de scraping dans le parcours de validation, pas de destinataire généré automatiquement.
- Les données issues du CV, du profil, du contenu des offres et du prompt sont traitées comme entrées non fiables.
- Les validations unitaires ne garantissent pas la prévention de toutes les hallucinations. Vérification humaine obligatoire.

## Frontend

`/dashboard/application-agent` : liste des options, création, prévisualisation, édition et sauvegarde, suggestion IA sur clic, case à cocher de validation, approbation, copie manuelle. Accès également depuis `/dashboard/applications` et la navigation générale. Aucun bouton n'exécute de soumission externe.

## Limites volontairement reportées

Intégration authentifiée aux plateformes de recrutement externes ; email réellement envoyé avec destinataire vérifié ; pièces jointes transportées ; justificatif de dépôt ; relance après envoi, journal d'audit externe ; tarification exacte par jetons. Ces éléments requièrent une conception d'exécution séparée avec autorisation atomique *liée au contenu et destinataire*, contrôle du domaine, idempotence, politique de conservation et gestion des échecs. **Il serait trompeur de prétendre qu'ils sont présents.**
