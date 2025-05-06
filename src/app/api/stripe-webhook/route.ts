// /app/api/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "../../../../prisma/prisma"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  const buf = await req.arrayBuffer();
  const rawBody = Buffer.from(buf);
  const sig = req.headers.get("stripe-signature")!;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error(`Webhook error: ${(err as Error).message}`);
    return new NextResponse("Webhook error", { status: 400 });
  }

  // traiter l’événement
//   if (event.type === "checkout.session.completed") {
//     const session = event.data.object as Stripe.Checkout.Session;
//     const userId = session.metadata?.userId;

//     // ✅ activer l’abonnement dans ta DB
//     await prisma.user.update({
//       where: { id: userId },
//       data: { isSubscribed: true },
//     });
//   }
if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const subscriptionId = session.subscription as string;
  
    await prisma.user.update({
      where: { id: userId },
      data: {
        isSubscribed: true,
        subscriptionId,
        generationCount: 0,
        lastGeneratedAt: new Date(),
      },
    });
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    
    await prisma.user.updateMany({
      where: { subscriptionId: subscription.id },
      data: { isSubscribed: false },
    });
  }

  return new NextResponse("Received", { status: 200 });
}
