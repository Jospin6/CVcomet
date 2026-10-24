import Stripe from "stripe";
import prisma from "../../../../prisma/prisma";
import { boundedBody } from "@/lib/career-profile/http";
import { planForStripePrice, stripeSubscriptionStatus } from "@/lib/security/stripe-billing";

export const runtime = "nodejs";

function periodEnd(sub: Stripe.Subscription): Date | null {
  const timestamp = sub.items.data[0]?.current_period_end;
  return timestamp ? new Date(timestamp * 1000) : null;
}

function stripeCustomerId(sub: Stripe.Subscription) {
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
}
function checkoutCustomerId(session: Stripe.Checkout.Session) {
  return typeof session.customer === "string" ? session.customer : session.customer?.id;
}

/**
 * Stripe signs the raw bytes. Never trust unsigned body, user-supplied plan,
 * or event delivery order as the source of subscription entitlements.
 */
export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Stripe webhook is not configured", { status: 503 });
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Signature required", { status: 400 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event: Stripe.Event;
  try {
    const raw = await boundedBody(req, 512 * 1024);
    event = stripe.webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response("Invalid event", { status: 400 });
  }

  if (!["checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    return new Response("ok");
  }

  try {
    const checkout = event.type === "checkout.session.completed" ? event.data.object as Stripe.Checkout.Session : null;
    const received = checkout ? null : event.data.object as Stripe.Subscription;
    const subId = checkout
      ? typeof checkout.subscription === "string" ? checkout.subscription : checkout.subscription?.id
      : received?.id;
    if (!subId) return new Response("ok");

    // Current remote state is authoritative for out-of-order webhook deliveries.
    const sub = await stripe.subscriptions.retrieve(subId);
    const customerId = stripeCustomerId(sub);
    const priceIds = sub.items.data.map(item => item.price.id);
    const plan = priceIds.length === 1
  ? planForStripePrice(priceIds[0], {
      STRIPE_PRO_PRICE_ID: process.env.STRIPE_PRO_PRICE_ID,
      STRIPE_CAREER_PRO_PRICE_ID:
        process.env.STRIPE_CAREER_PRO_PRICE_ID,
    })
  : null;
    if (!plan) {
      console.error("billing-webhook: unrecognized subscription price");
      // Retry until the recognized Stripe price IDs are configured correctly.
      return new Response("Unknown billing configuration", { status: 503 });
    }
    const status = stripeSubscriptionStatus(sub.status);
    const active = status === "ACTIVE" || status === "TRIALING";

    await prisma.$transaction(async tx => {
      const alreadyProcessed = await tx.billingWebhookEvent.findUnique({ where: { id: event.id }, select: { id: true } });
      if (alreadyProcessed) return;

      if (checkout) {
        // User and price originate in our authenticated checkout endpoint,
        // and must agree with the Stripe object actually paid for.
        const userId = checkout.metadata?.userId;
        if (!userId || checkout.client_reference_id !== userId ||
            checkout.metadata?.plan !== plan || sub.metadata?.userId !== userId ||
            sub.metadata?.plan !== plan || checkoutCustomerId(checkout) !== customerId) {
          throw new Error("CHECKOUT_METADATA_MISMATCH");
        }
        const user = await tx.user.findUnique({
          where: { id: userId }, select: { id: true, stripeCustomerId: true },
        });
        if (!user || user.stripeCustomerId !== customerId) throw new Error("CUSTOMER_MISMATCH");
        const current = await tx.subscription.findUnique({ where: { userId }, select: {
          id: true, stripeSubscriptionId: true, status: true, lastStripeEventCreated: true,
        } });
        if (current && current.stripeSubscriptionId && current.stripeSubscriptionId !== sub.id &&
            (current.status === "ACTIVE" || current.status === "TRIALING")) {
          throw new Error("CONCURRENT_ACTIVE_SUBSCRIPTIONS");
        }
        if (!current) {
          await tx.subscription.create({ data: { userId, plan, status,
            stripeCustomerId: customerId, stripeSubscriptionId: sub.id,
            stripePriceId: priceIds[0], currentPeriodEnd: periodEnd(sub),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            lastStripeEventCreated: event.created,
          } });
          await tx.user.update({ where: { id: userId }, data: { isSubscribed: active, subscriptionId: sub.id } });
        } else if (event.created >= current.lastStripeEventCreated) {
          await tx.subscription.update({ where: { id: current.id }, data: {
            plan, status, stripeCustomerId: customerId, stripeSubscriptionId: sub.id,
            stripePriceId: priceIds[0], currentPeriodEnd: periodEnd(sub),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            lastStripeEventCreated: event.created,
          } });
          await tx.user.update({ where: { id: userId }, data: { isSubscribed: active, subscriptionId: sub.id } });
        }
      } else {
        const existing = await tx.subscription.findUnique({ where: { stripeSubscriptionId: sub.id },
          select: { id: true, userId: true, stripeCustomerId: true, lastStripeEventCreated: true },
        });
        // A pre-checkout update may arrive first. Its checkout event will
        // fetch Stripe's latest status when it arrives.
        if (existing && existing.stripeCustomerId === customerId && event.created >= existing.lastStripeEventCreated) {
          await tx.subscription.update({ where: { id: existing.id }, data: {
            plan, status, stripePriceId: priceIds[0], currentPeriodEnd: periodEnd(sub),
            cancelAtPeriodEnd: sub.cancel_at_period_end, lastStripeEventCreated: event.created,
          } });
          await tx.user.update({ where: { id: existing.userId }, data: { isSubscribed: active, subscriptionId: sub.id } });
        }
      }
      await tx.billingWebhookEvent.create({ data: { id: event.id, type: event.type } });
    }, { timeout: 15000 });
    return new Response("ok");
  } catch (error) {
    // A webhook must return a retryable status on remote/DB errors.
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      // Distinguish a replay from any other unique-key conflict.
      const duplicate = await prisma.billingWebhookEvent.findUnique({ where: { id: event.id }, select: { id: true } });
      if (duplicate) return new Response("ok");
    }
    console.error("billing-webhook: processing failed", error instanceof Error ? error.message : "unknown");
    return new Response("Unable to process event", { status: 500 });
  }
}
