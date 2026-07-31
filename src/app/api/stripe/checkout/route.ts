// /app/api/checkout/route.ts
import { mainUrl } from "@/helpers/constants";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "../../../../../prisma/prisma"
import { canAccessUser, getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return new NextResponse("Missing STRIPE_SECRET_KEY", { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-04-30.basil",
  });

  const session = await getSessionUser();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { priceId, userId } = await req.json();

  if (!canAccessUser(session, userId)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

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
    } else {
      // 🔧 On met à jour le metadata si jamais il manque
      await stripe.customers.update(stripeCustomerId, {
        metadata: { userId },
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
    return new NextResponse("Erreur de checkout", { status: 500 });
  }
}
