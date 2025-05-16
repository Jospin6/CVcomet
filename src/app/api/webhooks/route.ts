
// // /app/api/webhook/route.ts
// import { NextResponse } from "next/server";
// import Stripe from "stripe";
// import prisma from "../../../../prisma/prisma";

// // Stripe instance
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: "2025-04-30.basil",
// });



// export async function POST(req: Request) {
//   const body = await req.text();

//   const sig = req.headers.get("stripe-signature") as string;
//   const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
//   let event: Stripe.Event;

//   try {
//     event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
//   } catch (err: any) {
//     console.log(`❌ Error message: ${err.message}`);
//     return new Response(`Webhook Error: ${err.message}`, { status: 400 });
//   }


//   if (event.type === "checkout.session.completed") {
//     try {
//       const session = event.data.object as Stripe.Checkout.Session;
//       const payment_status = session.payment_status;

//       if (payment_status === "paid") {
//         const sessionData = await stripe.checkout.sessions.retrieve(session.id, {
//           expand: ['metadata', 'customer', 'subscription'],
//         });

//         await prisma.user.update({
//           where: { id: sessionData.metadata!.userId },
//           data: {
//             isSubscribed: true,
//             subscriptionId: sessionData.subscription as string,
//             stripeCustomerId: sessionData.customer as string,
//             generationCount: 0,
//             lastGeneratedAt: new Date(),
//           },
//         });
//       }
//     } catch (error) {
//       console.error("Stripe webhook error:", error);
//     }
//   }


//   if (event.type === "customer.subscription.deleted") {
//     const subscription = event.data.object as Stripe.Subscription;

//     await prisma.user.updateMany({
//       where: { subscriptionId: subscription.id },
//       data: { isSubscribed: false },
//     });
//   }
//   return new NextResponse("✅ Webhook received", { status: 200 });
// }

// /app/api/webhook/route.ts

import { NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "../../../../prisma/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  const sig = req.headers.get("stripe-signature") as string;

  let rawBody: Buffer;

  try {
    // ✅ Utilise arrayBuffer au lieu de Readable.fromWeb
    const buffer = await req.arrayBuffer();
    rawBody = Buffer.from(buffer);
  } catch (err) {
    console.error("❌ Error getting raw body:", err);
    return new Response("Failed to read request body", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("❌ Stripe signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // ✅ Traitement des événements
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status === "paid") {
      const sessionData = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["metadata", "customer", "subscription"],
      });

      await prisma.user.update({
        where: { id: sessionData.metadata?.userId },
        data: {
          isSubscribed: true,
          subscriptionId: sessionData.subscription as string,
          stripeCustomerId: sessionData.customer as string,
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

  return new NextResponse("✅ Webhook received", { status: 200 });
}
