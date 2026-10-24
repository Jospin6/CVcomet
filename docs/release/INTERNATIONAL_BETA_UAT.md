# CVComet 2.0 — Recette internationale (staging)

**Version cible :** phase 00 à étape 14. **État initial :** aucun résultat staging validé. Inscrire pour chaque ligne le responsable, l'environnement, la date, la preuve (capture ou ID de test sans donnée personnelle) et la décision PASS/FAIL/BLOCKED.

| ID | Parcours | Critère observable de réussite | Statut initial |
| --- | --- | --- | --- |
| U01 | Inscription, login, vérification email et récupération | Codes expirables et anti-bruteforce, pas de changement d'email sans validation | BLOCKED |
| U02 | Utilisateur A/B et administrateur | Aucun accès intercompte aux CV, preuves, missions, lettres, candidatures ou feedback | BLOCKED |
| U03 | Coffre de preuves | Seuls les faits confirmés sont injectés dans l'outil confirmé ; édition révoque la confirmation | BLOCKED |
| U04 | Création/édition CV | Proposition IA visible avant application, refus respecté, conflit de révision détecté | BLOCKED |
| U05 | Exports CV | PDF et DOCX lisibles, édition Word possible ; formats A4/Letter corrects | BLOCKED |
| U06 | Lettres de motivation | Suggestions personnalisées et approbation explicite ; chiffres et diplômes non inventés | BLOCKED |
| U07 | Localisation RDC/FR/CA/US/UK/DE | Recommandations et mise en page adaptées ; informations personnelles non ajoutées automatiquement | BLOCKED |
| U08 | ATS & Job Intelligence | Explication des écarts, preuves visibles ; le score n'est pas présenté comme chance de recrutement | BLOCKED |
| U09 | Career Agent | Outils en lecture seule, résultats propres au compte ; refus des requêtes de modification/envoi | BLOCKED |
| U10 | Missions persistantes | Reprise, historique paginé, conflit d'exécution, suppression et confirmation de l'utilisateur | BLOCKED |
| U11 | Application Agent | Dossier créé/édité/approuvé ; aucun email ou soumission réelle sans intégration et autorisation | BLOCKED |
| U12 | Interview Coach | Evaluation contextualisée ; aucune note fictive si le fournisseur IA échoue | BLOCKED |
| U13 | Tarification et Stripe | Prix réels, webhooks signés et dédupliqués, absence de double abonnement/facturation | BLOCKED |
| U14 | Quotas et coût IA | Appels plafonnés, compteur conforme, tarification absente = coût USD non annoncé | BLOCKED |
| U15 | Observabilité et vie privée | Indicateurs admin corrects ; aucun contenu privé dans la télémétrie ; purge vérifiée | BLOCKED |
| U16 | Responsive + accessibilité | Clavier, lecteurs d'écran, contrastes, mobile et desktop, états de chargement/erreur | BLOCKED |
| U17 | Internationalisation et formats | Français/anglais/allemand, accents, dates, emails, papier et traductions sans altération des faits | BLOCKED |
| U18 | Défaillances et reprise | Réponses explicites aux erreurs réseau, 429, timeout, doublons, abandon d'une opération | BLOCKED |
| U19 | Build, migrations et sauvegarde | `npm ci`, `prisma generate`, migrations, typecheck, build et restauration de sauvegarde réussis | BLOCKED |
| U20 | Bêta et rollback | Support utilisateur, suivi d'incident, responsable, seuil de rollback, suppression de données de test | BLOCKED |

## Jeu de tests

- Au minimum : deux comptes candidats sans partage de données, un administrateur, un compte ayant expiré sa session, un compte sans faits confirmés.
- CV anonymisés consentis couvrant débutant/expérimenté et langues/pays prioritaires. Les modèles doivent être évalués sur exactitude factuelle, omissions importantes, utilité pour le poste, lisibilité, biais et compatibilité ATS.
- Pour le test Stripe, employer les clefs et cartes **du mode test**, pas de véritables paiements.
- Les candidats de test doivent pouvoir refuser l'enregistrement des conversations et comprendre qu'une candidature « prête » n'est pas envoyée.
- Les tests de sécurité et de confidentialité doivent inclure des tentatives d'accès aux identifiants de l'autre compte et des contenus de poste contenant des instructions malveillantes.

## Validation

- **GO** : toutes les lignes critiques U01–U15 et U19 ont des preuves valides ; les défauts bloquants sont corrigés ; les points juridiques et le support de lancement sont validés.
- **NO-GO** : un seul accès aux données d'un autre compte, une facturation erronée, une fuite de secret, une fausse déclaration de candidature envoyée, un échec de migration ou un build non validé.

**À la remise du code : NO-GO**, dans l'attente des tests réels. Aucun résultat hypothétique ne doit être déclaré comme déjà réussi.
