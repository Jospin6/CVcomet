import { NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { ProfileError, profileErrorResponse } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";

export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) throw new ProfileError(401, "UNAUTHORIZED");
    assertTrustedWriteOrigin(req);
    if (!process.env.STRIPE_SECRET_KEY) throw new ProfileError(503, "STRIPE_NOT_CONFIGURED");
    const user = await prisma.user.findUnique({ where: { id: session.id }, select: { stripeCustomerId: true } });
    if (!user?.stripeCustomerId) throw new ProfileError(404, "NO_BILLING_ACCOUNT");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl && process.env.NODE_ENV === "production") throw new ProfileError(503, "PUBLIC_URL_MISSING");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl || "http://localhost:3000"}/settings`,
    });
    return NextResponse.json({ url: portal.url }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return profileErrorResponse(error); }
}
