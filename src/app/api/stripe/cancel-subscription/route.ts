// /app/api/checkout/route.ts
import { mainUrl } from "@/helpers/constants";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "../../../../../prisma/prisma"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-04-30.basil",
});

export async function POST(req: NextRequest) {
    const { userId } = await req.json();
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });
    if (!user) {
        return new NextResponse("User not found", { status: 404 });
    }
    if (!user?.subscriptionId) {
        return new NextResponse("No active subscription", { status: 400 });
    }

    try {
        // ⛔ Annule l'abonnement à la fin de la période actuelle
        await stripe.subscriptions.update(user.subscriptionId, {
            cancel_at_period_end: true,
        });

        return new NextResponse("Subscription cancellation scheduled", {
            status: 200,
        });
    } catch (error) {
        return new NextResponse("Stripe error", { status: 500 });
    }
}