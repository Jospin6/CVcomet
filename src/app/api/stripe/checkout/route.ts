// /app/api/checkout/route.ts
import { mainUrl } from "@/helpers/constants";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "../../../../../prisma/prisma"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

export async function POST(req: NextRequest) {
  const { priceId, userId } = await req.json();

  try {
    // 1. Vérifie si l'utilisateur a déjà un customerId Stripe
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    let stripeCustomerId = user.stripeCustomerId;

    // 2. Si pas de customerId, on le crée et on le sauvegarde dans la DB
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        metadata: { userId }, // 👈 Pour lier au webhook
      });

      stripeCustomerId = customer.id;

      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId },
      });
    }

    // 3. Crée une session de paiement avec le customer
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer: stripeCustomerId, // 👈 Lien avec l'utilisateur
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${mainUrl}`,
      cancel_url: `${mainUrl}`,
      metadata: { userId }, // 👈 Pour le retrouver dans le webhook
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("❌ Stripe checkout error:", err);
    return new NextResponse("Erreur de checkout", { status: 500 });
  }
}