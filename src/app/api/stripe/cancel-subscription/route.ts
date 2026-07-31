// /app/api/checkout/route.ts
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

    const { userId } = await req.json();
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });
    if (!user) {
        return new NextResponse("User not found", { status: 404 });
    }
    if (!canAccessUser(session, userId)) {
        return new NextResponse("Forbidden", { status: 403 });
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
