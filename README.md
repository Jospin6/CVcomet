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
