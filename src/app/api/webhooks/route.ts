
import { NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "../../../../prisma/prisma";

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new NextResponse("Missing Stripe configuration", { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-04-30.basil",
  });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  const sig = req.headers.get("stripe-signature") as string;

  let rawBody: Buffer;

  try {
    // ✅ Utilise arrayBuffer au lieu de Readable.fromWeb
    const buffer = await req.arrayBuffer();
    rawBody = Buffer.from(buffer);
  } catch (err) {
    console.log("❌ Error getting raw body:", err);
    return new Response("Failed to read request body", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.log("❌ Stripe signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // ✅ Traitement des événements
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status === "paid") {
      const sessionData = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["customer", "subscription"],
      });

      await prisma.user.update({
        where: { id: sessionData.metadata?.userId },
        data: {
          isSubscribed: true,
          subscriptionId:
            typeof sessionData.subscription === "string"
              ? sessionData.subscription
              : sessionData.subscription?.id ?? null,
          stripeCustomerId:
            typeof sessionData.customer === "string"
              ? sessionData.customer
              : sessionData.customer?.id ?? null,
          generationCount: 0,
          lastGeneratedAt: new Date(),
        },
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;

    await prisma.user.updateMany({
      where: { subscriptionId: subscription.id },
      data: { isSubscribed: false },
    });
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;

    if (
      subscription.status === "canceled" ||
      subscription.status === "unpaid" ||
      subscription.status === "incomplete_expired"
    ) {
      await prisma.user.updateMany({
        where: { subscriptionId: subscription.id },
        data: { isSubscribed: false },
      });
    }
  }

  return new NextResponse("✅ Webhook received", { status: 200 });
}
