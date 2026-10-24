import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createHash } from "node:crypto";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { publicPrice } from "@/lib/billing/catalog";
import { z } from "zod";
import prisma from "../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { ProfileError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";

const input = z.object({ plan: z.enum(["PRO", "CAREER_PRO"]) }).strict();
export async function POST(req: Request) {
  try {
    const current = await getSessionUser();
    if (!current) throw new ProfileError(401, "UNAUTHORIZED");
    assertTrustedWriteOrigin(req);
    const { plan } = input.parse(await profileJson(req, 2048));
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new ProfileError(503, "STRIPE_NOT_CONFIGURED");
    const price = plan === "PRO" ? process.env.STRIPE_PRO_PRICE_ID : process.env.STRIPE_CAREER_PRO_PRICE_ID;
    if (!price) throw new ProfileError(503, "STRIPE_PRICE_MISSING");
    if (process.env.STRIPE_PRO_PRICE_ID && process.env.STRIPE_PRO_PRICE_ID === process.env.STRIPE_CAREER_PRO_PRICE_ID) throw new ProfileError(503, "STRIPE_PRICE_CONFIGURATION_INVALID");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl && process.env.NODE_ENV === "production") throw new ProfileError(503, "PUBLIC_URL_MISSING");
    const base = appUrl || "http://localhost:3000";
    const stripe = new Stripe(secret);
    const configuredPrice = publicPrice(await stripe.prices.retrieve(price));
    if (!configuredPrice) throw new ProfileError(503, "STRIPE_PRICE_CONFIGURATION_INVALID");
    const user = await prisma.user.findUnique({ where: { id: current.id }, select: { id: true, email: true, stripeCustomerId: true, isSubscribed: true, subscription: { select: { status: true } } } });
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    if (user.isSubscribed || user.subscription?.status === "ACTIVE" || (user.subscription?.status === "TRIALING" || user.subscription?.status === "PAST_DUE")) {
      throw new ProfileError(409, "SUBSCRIPTION_ALREADY_ACTIVE");
    }
    let customer = user.stripeCustomerId;
    if (!customer) {
      const record = await stripe.customers.create(
        { email: user.email, metadata: { userId: user.id } },
        { idempotencyKey: `cvcomet-customer-${user.id}` },
      );
      customer = record.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer } });
    }
    const checkoutKey = createHash("sha256")
      .update(`${user.id}:${plan}:${Math.floor(Date.now() / (10 * 60_000))}`).digest("hex");
    const checkout = await stripe.checkout.sessions.create({ mode: "subscription", customer,
      line_items: [{ price, quantity: 1 }],
      success_url: `${base}/settings?billing=success`, cancel_url: `${base}/upgrade`,
      client_reference_id: user.id, metadata: { userId: user.id, plan },
      subscription_data: { metadata: { userId: user.id, plan } },
    }, { idempotencyKey: `cvcomet-checkout-${checkoutKey}` });
    return NextResponse.json({ url: checkout.url }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return profileErrorResponse(error); }
}
