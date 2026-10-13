# CVcomet

Application Next.js 15 avec PostgreSQL, Prisma et Better Auth.

## Demarrer

Copier `env.example` vers `.env` et renseigner les variables, puis lancer :

```bash
npm install
npx prisma generate
npm run dev
```

L'application est disponible sur http://localhost:3000.

## Authentification

La connexion par email, l'inscription et la deconnexion utilisent Better Auth. Les anciennes API `/api/login`, `/api/signup`, `/api/logout` et `/api/me` utilisent cette meme session. Les anciens mots de passe bcrypt sont importes dans un compte Better Auth uniquement apres verification.

- `BETTER_AUTH_SECRET` : secret long et aleatoire. La configuration existante `JWT_SECRET` sert de remplacement si cette variable est absente.
- `BETTER_AUTH_URL` : origine de l'application, par exemple `http://localhost:3000`. En production, `NEXT_PUBLIC_APP_URL` peut aussi fournir cette origine.
- `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` : facultatifs. Le bouton Google est affiche lorsque les deux variables sont presentes lors de la compilation.
- `RESEND_API_KEY` et `RESEND_FROM_EMAIL` : facultatifs, pour les routes d'envoi de codes de verification.

Les API privees verifient la session et les droits dans la base. Les mots de passe et codes de verification ne sont jamais inclus dans les reponses utilisateur.

## Fournisseurs IA

Depuis **Administration > Réglages IA** (`/admin/ai`), un administrateur peut gérer OpenAI, Google Gemini, Claude (Anthropic), Hugging Face et Groq. Pour chaque fournisseur : ajouter/remplacer une clé, charger les modèles disponibles, sélectionner un identifiant, tester la génération JSON, enregistrer puis activer le fournisseur. Le bouton de test effectue une courte requête facturée selon votre offre. Aucun CV n’est envoyé par le test.

Le fournisseur actif s’applique aux imports, réécritures, CV, lettres de motivation, emails, analyses d’offres, titres de conversations et à l’assistant. Les requêtes déjà commencées terminent avec leur configuration ; les suivantes lisent immédiatement les nouveaux réglages, sans redémarrage.

Les clés saisies dans l’admin sont chiffrées avec AES-256-GCM et ne sont jamais renvoyées au navigateur. Configurez et sauvegardez `AI_CONFIG_ENCRYPTION_KEY` avec une valeur aléatoire longue, stable entre les déploiements. En son absence, le secret Better Auth (ou JWT historique) sert de remplacement. Changer ce secret impose de ressaisir les clés enregistrées. Les clés et modèles de `env.example` sont des valeurs initiales facultatives : les réglages en base ont priorité. Redémarrez le serveur après une modification de `.env`. Un fournisseur actif doit conserver une clé, un modèle et être disponible ; activez un autre fournisseur avant de le désactiver ou retirer sa clé.

Les PDF contenant du texte sont lus localement et fonctionnent avec les cinq fournisseurs ; DOCX et TXT aussi. Les PDF scannés sans texte nécessitent un modèle Google ou Claude prenant en charge les PDF, sinon utilisez un fichier avec du texte. La sélection d’un modèle arbitraire reste possible, mais il doit prendre en charge la génération de texte/JSON : vérifiez-le avec le bouton **Tester le modèle**.

`npm run check:ai` consulte la liste des modèles du fournisseur actif, sans document ni génération. Le test admin vérifie aussi les réponses JSON. Les erreurs d’accès, quota, délai et modèle indisponible sont distinguées sans exposer de clés ni de données personnelles.

Interfaces utilisées : [Google](https://v4.ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai), [Claude](https://v4.ai-sdk.dev/providers/ai-sdk-providers/anthropic), [Groq compatible OpenAI](https://console.groq.com/docs/openai) et [Hugging Face Router](https://huggingface.co/docs/inference-providers/en/hub-api).

## Base de donnees

`DATABASE_URL` fournit la connexion de l'application. `DATABASE_URL_UNPOOLED` fournit la connexion directe utilisee par les migrations Prisma ; sur une base locale, les deux URL peuvent etre identiques.

Pour une nouvelle base vide :

```bash
npx prisma migrate deploy
```

La mise a niveau de l'ancienne base configuree a utilise `prisma/database-upgrade.sql` et `scripts/upgrade-database.cjs`. Le script refuse les suppressions et les modifications de colonnes existantes, verifie le schema avant l'execution, applique les ajouts dans une transaction et compare les nombres de lignes existantes. Il enregistre ensuite les migrations historiques avec Prisma, une fois le schema complet present. Le SQL correspond a l'etat de cette ancienne base ; une autre base necessite sa propre comparaison et une revue.

```bash
npx prisma migrate status
```

## Verifications

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Les tests couvrent les sessions, les anciens mots de passe, les droits administrateur, les profils et les documents.

Pour verifier l'authentification sur PostgreSQL avec la configuration de `.env` :

```bash
npm run test:auth:db
```

Ce dernier test cree un compte et des sessions dans une transaction annulee a la fin, puis verifie qu'aucune ligne de test n'a ete conservee.
