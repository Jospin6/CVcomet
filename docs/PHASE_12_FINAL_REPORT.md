# CVComet 2.0 — Étape 12/14 : Business Model & Monetization

Date : 24 octobre 2026. Implémentation locale, non certifiée pour la production.

## Objectifs et résultats

Cette étape consolide les offres FREE / PRO / CAREER_PRO, l'affichage des tarifs de Stripe, les contrôles de checkout/annulation et la visibilité sur les quotas et le coût estimé des opérations IA enregistrées.

- `GET /api/billing/plans` : catalogue public, quotas internes et prix récurrents Stripe vérifiés (actifs, fixes, périodiques). Un tarif manquant ou invalide rend l'offre indisponible, sans montant inventé.
- `GET /api/billing/overview` : authentification obligatoire, données de la session uniquement ; période UTC, plan, état, quotas, consommation et couverture des estimations.
- `GET /api/admin/billing/summary` : accès administrateur obligatoire ; répartition par état/plan, statistiques de consommation enregistrée, absence explicite de chiffre d'affaires et bénéfice non prouvés.
- Les pages `/pricing` et `/upgrade`, les réglages utilisateur et le tableau de bord admin orientent désormais vers ces données.
- Le checkout valide le Price Stripe avant la création d'une session ; deux offres ne peuvent pas pointer vers le même Price ID.
- L'annulation vérifie l'identifiant abonnement de la relation Prisma et le customer côté Stripe au lieu de se fier uniquement au champ historique `user.subscriptionId`.
- Le Career Agent enregistre maintenant le coût **estimé** de ses appels terminés lorsque les tarifs du modèle sont explicitement configurés. Si un tarif ou les tokens sont inconnus, aucun coût USD n'est inventé.

## Variable d'environnement nouvelle

`AI_MODEL_COSTS_JSON` : chaîne JSON facultative des tarifs par fournisseur et modèle en **USD par million de tokens**. Exemple **purement illustratif, non tarif contractuel** :

```dotenv
AI_MODEL_COSTS_JSON='{"OPENAI":{"model-example":{"inputUSDPerMillion":1,"outputUSDPerMillion":2}}}'
```

Remplacer `model-example` et les montants par les **tarifs vérifiés en vigueur dans les contrats des fournisseurs**. Utiliser exactement l'identifiant du modèle configuré et le nom du fournisseur (OPENAI, GOOGLE, ANTHROPIC, GROQ, HUGGINGFACE). Ne pas inclure d'information personnelle dans cette variable.

Les variables de facturation existantes demeurent nécessaires : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_CAREER_PRO_PRICE_ID`, `NEXT_PUBLIC_APP_URL`. Les prix doivent être distincts, actifs, récurrents, fixes et correspondre au produit vendu. Aucune nouvelle migration Prisma n'est nécessaire (AIUsage.estimatedCost existe déjà).

## Sécurité et exactitude

- Le prix utilisé pour le checkout est choisi côté serveur et vérifié chez Stripe ; jamais accepté depuis le corps de la requête.
- Les nouvelles métriques de facturation utilisateur sont scopées sur le compte authentifié, avec `Cache-Control: private, no-store`.
- La synthèse financière admin est protégée par `requireAIAdmin`, et ne fournit aucune facture, donnée bancaire ni secret Stripe.
- Seules les opérations IA enregistrées dans la table `AIUsage` sont couvertes par les métriques actuelles. En l'état, ce suivi **n'englobe pas encore tous les appels historiques et les différents workflows IA**. Les statistiques ne doivent pas être présentées comme la consommation globale vérifiée.
- L'estimation de coût suit les tarifs configurés localement ; elle ne reflète pas forcément les règles de cache, les tokens spéciaux, les paliers, les taux de change ni les factures officielles des fournisseurs.
- Le modèle d'abonnement hérité `isSubscribed` reste présent ; un audit de migration des abonnements historiques sera nécessaire avant de supprimer ce chemin de compatibilité.
- Les paiements, la conformité fiscale, les remboursements, chargebacks, factures, TVA et marges réelles restent sous la responsabilité de Stripe et de la réconciliation financière ; aucun de ces chiffres n'est fabriqué.

## Vérifications locales

- `npm run test:phase12` : tests des politiques de prix, des tarifs, de la robustesse et des frontières d'API.
- `npm run test:cvcomet:baseline` : toutes les suites ciblées des phases 00 à 12.
- Vérification syntaxique TypeScript/TSX sans dépendances externes.
- Comparaison des fichiers avec l'archive d'origine, puis validation du ZIP cumulatif et de ses empreintes SHA-256.

Non effectués : typecheck sémantique complet avec les dépendances, `next build`, tests E2E PostgreSQL / Better Auth / Stripe (paiement, changement de plan, annulation, remboursements) et fournisseurs IA réels. **Ne pas déployer cette livraison en production sans recette en staging.**

## Recette staging indispensable

1. Sauvegarder la base et intégrer le ZIP cumulatif à la racine du dépôt original.
2. Installer les dépendances ; appliquer les migrations des étapes précédentes ; générer Prisma ; exécuter typecheck et build Next.js.
3. Avec Stripe TEST MODE, créer les Price IDs PRO et CAREER_PRO distincts ; vérifier montants, devises, période et affichage des taxes en checkout.
4. Tester utilisateurs gratuits, abonnement en essai, actif, en retard, annulé, renouvellement, rejet de paiement, upgrade/downgrade via portal, déduplication des webhooks, origine et contrôle de propriété.
5. Valider les quotas avec plusieurs requêtes concurrentes sur des instances différentes et un modèle IA réellement actif.
6. Configurer les taux fournisseurs (facultatif), comparer les estimations de tokens aux résultats des fournisseurs et vérifier l'absence de montant estimé sur les opérations non couvertes.
7. Faire un audit des données d'abonnement historiques avant toute modification de migration du flag `isSubscribed`.

## Dépendances des prochaines étapes

Étape 13 : instrumenter **tous** les workflows IA, exporter les métriques et mesurer la rentabilité avec revenus Stripe réconciliés, frais, taxes, incidents et monitoring. Étape 14 : tests de paiement et lancement international progressif.
