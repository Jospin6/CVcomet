import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { aiQuotaStatus } from "@/lib/ai/quota-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only self-scoped financial visibility; AI estimate covers recorded calls, not provider invoices. */
export async function GET() {
  try {
    const actor = await requireUser();
    const monthStart = new Date();
    monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const [quota, subscription, usage] = await Promise.all([
      aiQuotaStatus(actor.id),
      prisma.subscription.findUnique({ where: { userId: actor.id }, select: {
        plan: true, status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true,
      } }),
      prisma.aIUsage.aggregate({ where: { userId: actor.id, createdAt: { gte: monthStart } },
        _count: { _all: true, estimatedCost: true }, _sum: { inputTokens: true, outputTokens: true, estimatedCost: true } }),
    ]);
    const count = usage._count._all;
    const costed = usage._count.estimatedCost;
    return NextResponse.json({
      plan: quota.plan,
      subscription: subscription ? {
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      } : { status: "INACTIVE", currentPeriodEnd: null, cancelAtPeriodEnd: false },
      quota,
      aiUsage: {
        periodStart: monthStart.toISOString(), trackedCalls: count, ratedCalls: costed,
        inputTokens: usage._sum.inputTokens ?? 0, outputTokens: usage._sum.outputTokens ?? 0,
        /** A partial cost is never shown as a complete cost. */
        estimatedUSD: count > 0 && count === costed && usage._sum.estimatedCost !== null
          ? usage._sum.estimatedCost.toString() : null,
        coverage: count === 0 ? "no_recorded_calls" : costed === count ? "recorded_calls_only" : "incomplete",
      },
      disclaimer: "Usage data may omit legacy workflows; any USD figure is an estimate, not your invoice.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
