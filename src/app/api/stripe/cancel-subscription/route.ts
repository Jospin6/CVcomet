import { NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "../../../../../prisma/prisma";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { ProfileError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";

const input = z.object({ userId: z.string().uuid().optional() }).strict();

export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) throw new ProfileError(401, "UNAUTHORIZED");
    assertTrustedWriteOrigin(req);
    const { userId } = input.parse(await profileJson(req, 2048));
    if (userId && userId !== session.id) throw new ProfileError(403, "FORBIDDEN");
    if (!process.env.STRIPE_SECRET_KEY) throw new ProfileError(503, "STRIPE_NOT_CONFIGURED");
    const user = await prisma.user.findUnique({ where: { id: session.id }, select: { stripeCustomerId: true,
      subscription: { select: { stripeSubscriptionId: true, stripeCustomerId: true, status: true } },
    } });
    const record = user?.subscription;
    if (!user?.stripeCustomerId || !record?.stripeSubscriptionId || record.stripeCustomerId !== user.stripeCustomerId) {
      throw new ProfileError(404, "SUBSCRIPTION_NOT_FOUND");
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const remote = await stripe.subscriptions.retrieve(record.stripeSubscriptionId);
    const remoteCustomer = typeof remote.customer === "string" ? remote.customer : remote.customer.id;
    if (remoteCustomer !== user.stripeCustomerId) throw new ProfileError(403, "SUBSCRIPTION_CUSTOMER_MISMATCH");
    if (remote.status === "canceled") throw new ProfileError(409, "SUBSCRIPTION_ALREADY_CANCELED");
    await stripe.subscriptions.update(remote.id, { cancel_at_period_end: true });
    return NextResponse.json({ scheduled: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return profileErrorResponse(error); }
}
