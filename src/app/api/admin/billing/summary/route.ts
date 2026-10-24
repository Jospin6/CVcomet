import { requireAIAdmin, aiAdminError, aiAdminResponse } from "@/lib/ai/admin-http";
import prisma from "../../../../../../prisma/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Admin operational counters, not revenue/profit claims; invoices live in Stripe. */
export async function GET(req: Request) {
  try {
    await requireAIAdmin(req);
    const month = new Date();
    month.setUTCDate(1); month.setUTCHours(0, 0, 0, 0);
    const [subscriptions, usage] = await Promise.all([
      prisma.subscription.groupBy({ by: ["plan", "status"], _count: { _all: true } }),
      prisma.aIUsage.aggregate({ where: { createdAt: { gte: month } },
        _count: { _all: true, estimatedCost: true }, _sum: { estimatedCost: true, inputTokens: true, outputTokens: true } }),
    ]);
    const calls = usage._count._all;
    const pricedCalls = usage._count.estimatedCost;
    return aiAdminResponse({
      monthStart: month.toISOString(),
      subscriptions: subscriptions.map(row => ({ plan: row.plan, status: row.status, count: row._count._all })),
      aiUsage: {
        trackedCalls: calls, ratedCalls: pricedCalls,
        inputTokens: usage._sum.inputTokens ?? 0, outputTokens: usage._sum.outputTokens ?? 0,
        estimatedUSD: calls > 0 && calls === pricedCalls && usage._sum.estimatedCost !== null
          ? usage._sum.estimatedCost.toString() : null,
        coverage: calls === 0 ? "no_recorded_calls" : pricedCalls === calls ? "recorded_calls_only" : "incomplete",
      },
      revenue: null,
      profit: null,
      note: "Stripe invoices, taxes, fees, disputes and untracked AI calls are not included. No profit is inferred.",
    });
  } catch (error) { return aiAdminError(error); }
}
