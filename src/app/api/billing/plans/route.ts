import { NextResponse } from "next/server";
import Stripe from "stripe";
import { planCatalog, publicPrice } from "@/lib/billing/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public display-only catalog. The checkout endpoint remains the authority. */
export async function GET() {
  const plans = planCatalog(process.env);
  const secret = process.env.STRIPE_SECRET_KEY;
  let stripe: Stripe | null = null;
  if (secret) stripe = new Stripe(secret);
  const prices = await Promise.all(plans.map(async plan => {
    if (plan.key === "FREE") return { ...plan, available: true, price: { currency: "USD", amountMinor: 0, interval: null, intervalCount: 0 } };
    const priceId = plan.key === "PRO" ? process.env.STRIPE_PRO_PRICE_ID : process.env.STRIPE_CAREER_PRO_PRICE_ID;
    if (!stripe || !priceId) return { ...plan, available: false, price: null };
    try {
      const raw = await stripe.prices.retrieve(priceId);
      const safe = publicPrice(raw);
      return { ...plan, available: !!safe, price: safe };
    } catch {
      return { ...plan, available: false, price: null };
    }
  }));
  return NextResponse.json({ plans: prices, source: "configured_stripe_prices", priceDisclaimer: "Tax and discounts are confirmed by Stripe Checkout." },
    { headers: { "Cache-Control": "no-store" } });
}
