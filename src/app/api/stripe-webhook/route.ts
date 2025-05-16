// // /app/api/webhook/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import Stripe from "stripe";
// import prisma from "../../../../prisma/prisma"



// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: "2025-04-30.basil",
// });

// export const config = { api: { bodyParser: false } };

// export async function POST(req: NextRequest) {
//   const buf = await req.arrayBuffer();
//   const rawBody = Buffer.from(buf);
//   const sig = req.headers.get("stripe-signature")!;

//   let event;

//   try {
//     event = stripe.webhooks.constructEvent(
//       rawBody,
//       sig,
//       process.env.STRIPE_WEBHOOK_SECRET || "whsec_rNpx8BOcaghaHZAOYBx6wRzvD2NVN4EP"
//     );
//   } catch (err) {
//     console.error(`Webhook error: ${(err as Error).message}`);
//     return new NextResponse("Webhook error", { status: 400 });
//   }

// if (event.type === "checkout.session.completed") {
//     const session = event.data.object as Stripe.Checkout.Session;
//     const userId = session.metadata?.userId;
//     const subscriptionId = session.subscription as string;

//     await prisma.user.update({
//       where: { id: userId },
//       data: {
//         isSubscribed: true,
//         subscriptionId,
//         generationCount: 0,
//         lastGeneratedAt: new Date(),
//       },
//     });
//   }

//   if (event.type === "customer.subscription.deleted") {
//     const subscription = event.data.object as Stripe.Subscription;

//     await prisma.user.updateMany({
//       where: { subscriptionId: subscription.id },
//       data: { isSubscribed: false },
//     });
//   }

//   return new NextResponse("Received", { status: 200 });
// }

// /app/api/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "../../../../prisma/prisma";
import { headers } from "next/headers";

// Stripe instance
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

// Nécessaire pour désactiver le body parsing par défaut

// export async function POST(req: Request) {
//   const body = await req.text();
//   const sig = req.headers.get("stripe-signature")!;

//   let event: Stripe.Event;

//   try {
//     event = stripe.webhooks.constructEvent(
//       body,
//       sig,
//       process.env.STRIPE_WEBHOOK_SECRET!
//     );
//   } catch (err) {
//     console.error("❌ Webhook signature verification failed.", err);
//     return new NextResponse("Webhook error", { status: 400 });
//   }

//   const session = event.data.object as Stripe.Checkout.Session;

//   // ✅ Traiter l'événement Stripe
//   if (event.type === "checkout.session.completed") {
//     const userId = session.metadata?.userId;
//     const subscriptionId = session.subscription as string;

//     if (!userId || !subscriptionId) {
//       console.error("❌ Missing metadata.");
//       return new NextResponse("Missing metadata", { status: 400 });
//     }

//     await prisma.user.update({
//       where: { id: userId },
//       data: {
//         isSubscribed: true,
//         subscriptionId,
//         generationCount: 0,
//         lastGeneratedAt: new Date(),
//       },
//     });
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

export async function POST(req: Request) {
  const body = await req.text();
  const sig = (await headers()).get('Stripe-Signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret) return;
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.log(`❌ Error message: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }


  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const subscriptionId = session.subscription as string;

    if (!userId || !subscriptionId) {
      console.error("❌ Missing metadata.");
      return new NextResponse("Missing metadata", { status: 400 });
    }

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
  return new NextResponse("✅ Webhook received", { status: 200 });
}
