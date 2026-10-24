# Billing & Monetization — architecture CVComet 2.0, v1

## Source de vérité

Stripe : tarifs récurrents affichés, checkout, abonnements facturés et factures.
PostgreSQL (`Subscription`) : miroir applicatif d'entitlements synchronisé par webhooks Stripe signés ; l'état absent/inactif ne donne pas automatiquement un droit payant.
PostgreSQL (`AiQuotaWindow`, `User.generationCount`) : quotas atomiques internes, indépendants des coûts USD.
PostgreSQL (`AIUsage`) : consommation IA explicitement enregistrée ; sous-ensemble incomplet des opérations globales.

## Flux de souscription

1. Le client affiche `GET /api/billing/plans` (montants vérifiés par Stripe, désactivés si non configurés).
2. L'utilisateur choisit PRO ou CAREER_PRO : `POST /api/stripe/checkout {plan}`.
3. Le serveur vérifie la session, l'origine, le plan et le Price Stripe. Les Price IDs ne proviennent jamais du client.
4. Stripe Checkout réalise le paiement ; le webhook signé réconcilie l'état applicatif avec le prix effectif et la dernière souscription Stripe.
5. Le portal Stripe gère les changements de facturation et les moyens de paiement ; les droits ne sont accordés qu'après état webhook validé.

## Consommation

`AiQuotaWindow` exprime des crédits de **charge**, pas des dollars, et empêche un utilisateur d'épuiser sans limite les ressources. Des tarifs USD facultatifs (`AI_MODEL_COSTS_JSON`) permettent d'estimer le coût des **appels explicitement tracés**, actuellement ceux du Career Agent. Les estimations non couvertes restent `null`.

## Séparation et confidentialité

- `/api/billing/overview` : propriétaire uniquement, identifiant dérivé de la session serveur.
- `/api/admin/billing/summary` : administrateur uniquement.
- Aucun endpoint ne retourne de carte bancaire, de clé d'API ni de secret webhook.
- `Cache-Control: no-store` évite la réutilisation de réponses personnelles.

## Limites connues

- Il manque une instrumentation de coûts unifiée pour les autres routes IA, une réconciliation financière et une comptabilisation des taxes, remises et frais réels. Aucun ROI ou bénéfice n'est présenté.
- Pas de tableau des revenus réels ni de marge : la comptabilité devra utiliser les données vérifiées des factures/frais Stripe et celles des prestataires IA.
- Entitlements hérités `isSubscribed` et plans effectifs doivent être migrés prudemment.
- Toutes les intégrations Stripe TEST MODE / PostgreSQL réel et les builds restent à valider avant production.
