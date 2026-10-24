import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { profileDataSchema } from "@/lib/career-profile/schema";
import { profileJson, profileErrorResponse, ProfileError } from "@/lib/career-profile/http";
import { canAccessUser, getSessionUser, sanitizeUser } from "@/lib/auth";
import { accountEmailChanged } from "@/lib/security/account-email";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { subscriptionBlocksDeletion } from "@/lib/security/stripe-billing";
import Stripe from "stripe";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  if (!canAccessUser(session, id)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      Experience: true,
      Education: true,
      Project: true,
      certifications: true,
    },
  });

  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  return NextResponse.json(sanitizeUser(user));
}

export async function PUT(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  if (!canAccessUser(session, id)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try { assertTrustedWriteOrigin(req); } catch (error) { return profileErrorResponse(error); }
  let body;
  try {
    body = profileDataSchema.pick({ name: true, email: true, phone: true, languages: true, address: true, linkedin: true, portfolio: true, github: true, skills: true }).partial().parse(await profileJson(req));
  } catch (error) { return profileErrorResponse(error); }
  const {
    name,
    email,
    phone,
    languages,
    address,
    linkedin,
    portfolio,
    github,
    skills,
  } = body;

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  if (accountEmailChanged(user.email, email)) {
    return NextResponse.json({ error: "EMAIL_CHANGE_REQUIRES_VERIFICATION" }, { status: 409 });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        profileRevision: { increment: 1 },
        name,
        phone,
        address,
        languages,
        github,
        linkedin,
        portfolio,
        skills,
      },
    });

    return NextResponse.json(sanitizeUser(updatedUser), { status: 200 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ message: "Email already exists" }, { status: 409 });
    }

    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).pathname.split("/").pop() as string;
  const session = await getSessionUser();
  // An ordinary account-deletion endpoint must never permit staff to delete
  // somebody else's account without a separate audited admin workflow.
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (session.id !== id) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    assertTrustedWriteOrigin(req);
    const user = await prisma.user.findUnique({ where: { id }, select: {
      id: true, isSubscribed: true, subscriptionId: true,
      subscription: { select: { status: true, stripeSubscriptionId: true } },
    } });
    if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const stripeId = user.subscription?.stripeSubscriptionId || user.subscriptionId;
    if (stripeId) {
      if (!process.env.STRIPE_SECRET_KEY) throw new ProfileError(503, "STRIPE_NOT_CONFIGURED");
      // Reject deletion of subscriptions that would otherwise continue billing.
      const remote = await new Stripe(process.env.STRIPE_SECRET_KEY).subscriptions.retrieve(stripeId);
      if (subscriptionBlocksDeletion(user.subscription?.status || null, remote.status)) {
        return NextResponse.json({ error: "SUBSCRIPTION_STILL_BILLABLE" }, { status: 409 });
      }
    } else if (user.isSubscribed || subscriptionBlocksDeletion(user.subscription?.status || null)) {
      return NextResponse.json({ error: "SUBSCRIPTION_REQUIRES_REVIEW" }, { status: 409 });
    }
    // Ownership FK cascades are applied by the Phase 00.4 migration. This
    // removes all child career data, sessions and OAuth accounts atomically.
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return profileErrorResponse(error);
  }
}
