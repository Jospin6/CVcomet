/** Stripe price IDs, not client-supplied metadata, grant entitlement tiers. */
export function planForStripePrice(priceId: string, env: { STRIPE_PRO_PRICE_ID?: string; STRIPE_CAREER_PRO_PRICE_ID?: string }): "PRO" | "CAREER_PRO" | null {
  if (priceId && env.STRIPE_CAREER_PRO_PRICE_ID && priceId === env.STRIPE_CAREER_PRO_PRICE_ID) return "CAREER_PRO";
  if (priceId && env.STRIPE_PRO_PRICE_ID && priceId === env.STRIPE_PRO_PRICE_ID) return "PRO";
  return null;
}

export function stripeSubscriptionStatus(status: string): "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "INACTIVE" {
  if (status === "active") return "ACTIVE";
  if (status === "trialing") return "TRIALING";
  if (status === "past_due") return "PAST_DUE";
  if (status === "canceled") return "CANCELED";
  return "INACTIVE";
}

export function subscriptionBlocksDeletion(status: string | null, remoteStatus?: string): boolean {
  if (remoteStatus) return remoteStatus !== "canceled" && remoteStatus !== "incomplete_expired";
  return status === "ACTIVE" || status === "TRIALING" || status === "PAST_DUE";
}
