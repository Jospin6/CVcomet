# Import LinkedIn vers un CV

Dans **Mes documents → Importer depuis LinkedIn**, le PDF exporté par LinkedIn
et le texte collé du profil sont analysés avec le fournisseur IA déjà configuré
dans l’application. Le CV est enregistré pour l’utilisateur connecté puis ouvert
dans l’éditeur existant, avec son téléchargement PDF habituel. Le profil carrière
central n’est pas modifié. Aucune migration n’est nécessaire.

L’import utilise la même limite quotidienne que les autres opérations IA. Les
tentatives échouées après réservation comptent dans cette limite. Aucun CV n’est
créé si la récupération ou l’extraction échoue, ou si le document ne contient pas
d’informations professionnelles.

## Activer l’import automatique par URL

Sans fournisseur configuré, l’interface explique que l’import par lien est
indisponible et propose le PDF ou le texte. Aucune requête LinkedIn ni création
de CV à partir d’un simple lien n’est alors effectuée.

Deux intégrations serveur sont prévues ; choisir l’une d’elles et redémarrer
Next.js. Ne pas préfixer ces variables par `NEXT_PUBLIC_`.

### API personnalisée

```dotenv
LINKEDIN_IMPORT_API_URL=https://votre-service.example/linkedin/profile
LINKEDIN_IMPORT_API_KEY=votre-cle-serveur
```

Le serveur envoie `POST` à cette adresse HTTPS, avec :

```http
Content-Type: application/json
Authorization: Bearer <LINKEDIN_IMPORT_API_KEY>
```

```json
{ "url": "https://www.linkedin.com/in/identifiant/" }
```

La clé est facultative si le service ne la nécessite pas. La réponse HTTP 200 est
un objet JSON contenant les données professionnelles effectivement récupérées :

```json
{
  "profile": {
    "name": "Nom fourni par le profil",
    "headline": "Intitulé fourni par le profil",
    "summary": "Résumé fourni par le profil",
    "experiences": [],
    "education": [],
    "skills": [],
    "languages": [],
    "projects": [],
    "certifications": []
  }
}
```

Les champs peuvent être omis. Les objets sous `person`, les objets de profil
directs et le premier élément d’un tableau sont également acceptés. Les données
restent soumises à la validation et aux règles factuelles de l’extracteur.
Retourner 404 si le profil n’est pas accessible, 429 pour une limite du service,
ou un code 5xx en cas d’incident. Délai de récupération maximal : 25 secondes ;
réponse maximale : 1 Mo, dont 120 000 caractères de données de profil.

### Scrapingdog

```dotenv
SCRAPINGDOG_API_KEY=votre-cle-serveur
```

Sans API personnalisée, le serveur utilise l’endpoint documenté
`https://api.scrapingdog.com/profile`, avec `type=profile` et l’identifiant du
profil. Cette opération consomme les crédits du compte fournisseur. Aucune
requête payante n’est lancée par les tests automatisés.

Référence : [Profile Scraper API](https://www.scrapingdog.com/profile-scraper-api/).

## Vérification

```text
node --test scripts/linkedin-import.test.cjs
npm run typecheck
```

Les tests isolent l’authentification, l’IA, le fournisseur et la base. Ils vérifient
notamment l’appartenance du CV, les limites, les profils vides, les erreurs du
fournisseur et l’absence de persistance en cas d’échec.

Avec le serveur de développement lancé, le contrôle visuel peut être exécuté
avec `node scripts/verify-linkedin-import-ui.cjs`. Il utilise le vrai composant
et des réponses HTTP fictives, sans créer de compte ni appeler de service payant.
La route de prévisualisation temporaire est retirée à la fin. Les captures et
le rapport sont enregistrés dans `docs/resume-editor/linkedin-import/` (ignoré
par Git). Si les nouvelles routes ne sont pas détectées par le serveur local,
redémarrer ce dernier pendant que le contrôle attend sa page de prévisualisation.

Les instructions d’export suivent l’[aide LinkedIn](https://www.linkedin.com/help/linkedin/answer/a541960/).
LinkedIn ne propose pas cet export dans son application mobile et ne l’active
pas pour tous les profils ; le texte collé reste disponible dans ces situations.
