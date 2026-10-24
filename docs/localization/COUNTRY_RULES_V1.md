# Global Career Localization — politique de version 1

Les paramètres `targetMarket` et `documentLanguage` sont des **préférences sur le document** ; ils ne prouvent pas où l'utilisateur habite, sa nationalité ou son éligibilité au poste.

## Contrats

- `targetMarket` : `GLOBAL`, `CD`, `FR`, `CA`, `US`, `GB`, `DE`.
- `documentLanguage` : `auto`, `fr`, `en`, `de`. Le mode `auto` suit une langue indicative par pays. Pour `GLOBAL`, la langue historique de l'utilisateur reste prioritaire.
- `paper` : `A4`, `LETTER`. Changer le marché dans le studio propose le papier recommandé. Le choix de la langue n'altère pas les faits du candidat.
- La photo, le numéro d'identité, la date de naissance, les affiliations et l'état civil ne sont **jamais ajoutés automatiquement**. Les instructions de l'employeur priment.
- Le texte des offres d'emploi est **non fiable** et ne prouve aucune qualification du candidat.

## Sources et précautions

Les références sont stockées dans `src/lib/career-localization/markets.ts` et présentées dans l'interface. Pour la RDC et le mode international, il s'agit de recommandations éditoriales sans prétention réglementaire.

Les conseils peuvent évoluer ; revérifier à chaque actualisation majeure et conserver la date de validation, la version et une trace de la source. Les CV destinés au secteur public (notamment USAJOBS) demandent des contrôles additionnels qui ne sont pas implémentés par ce moteur.

## Déploiement

Les préférences sont intégrées au champ JSON `design` existant ; aucune nouvelle migration pour l'étape 05. La migration des autres phases reste nécessaire. Les tests automatisés sont des tests ciblés et ne remplacent pas des vérifications manuelles du rendu PDF, des exports dans Word, de l'authentification et des providers IA.
