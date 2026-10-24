import prisma from "../../../prisma/prisma";
import { ProfileError } from "@/lib/career-profile/http";
import { aiCredits, aiQuotaLimits, quotaWindowKey, quotaWindowStart, resolveAIQuotaPlan, type AIQuotaFeature, type AIQuotaPlan } from "./quota-policy";

/**
 * A DB-backed, cross-instance reservation that charges failed provider attempts as well.
 * Every reservation is atomic across the legacy daily counter and hourly/monthly windows.
 * Credits represent bounded workload, not currency. No Redis/in-memory correctness dependency.
 */
export async function reserveAIQuota(userId: string, feature: AIQuotaFeature = "GENERAL") {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const credits = aiCredits(feature);
  return prisma.$transaction(async tx => {
    const [user, subscription] = await Promise.all([
      tx.user.findUnique({ where: { id: userId }, select: { isSubscribed: true } }),
      tx.subscription.findUnique({ where: { userId }, select: { plan: true, status: true } }),
    ]);
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const plan: AIQuotaPlan = resolveAIQuotaPlan(subscription, user.isSubscribed);
    const limits = aiQuotaLimits(plan, process.env);
    const reset = await tx.user.updateMany({
      where: { id: userId, OR: [{ lastGeneratedAt: null }, { lastGeneratedAt: { lt: today } }] },
      data: { generationCount: 1, lastGeneratedAt: now },
    });
    if (!reset.count) {
      const increment = await tx.user.updateMany({
        where: { id: userId, lastGeneratedAt: { gte: today }, generationCount: { lt: limits.daily } },
        data: { generationCount: { increment: 1 }, lastGeneratedAt: now },
      });
      if (!increment.count) throw new ProfileError(429, "AI_LIMIT");
    }

    for (const window of [
      { period: "HOUR" as const, start: quotaWindowStart(now, "HOUR"), maxRequests: limits.hourly, maxCredits: null },
      { period: "MONTH" as const, start: quotaWindowStart(now, "MONTH"), maxRequests: null, maxCredits: limits.monthlyCredits },
    ]) {
      const key = quotaWindowKey(userId, window.period, window.start);
      await tx.aiQuotaWindow.upsert({
        where: { key },
        create: { key, userId, period: window.period, windowStart: window.start },
        update: {},
      });
      const allowed = await tx.aiQuotaWindow.updateMany({
        where: { key,
          ...(window.maxRequests !== null ? { requests: { lt: window.maxRequests } } : {}),
          ...(window.maxCredits !== null ? { credits: { lte: window.maxCredits - credits } } : {}),
        },
        data: { requests: { increment: 1 }, credits: { increment: credits } },
      });
      if (!allowed.count) throw new ProfileError(429, window.period === "HOUR" ? "AI_HOURLY_LIMIT" : "AI_MONTHLY_LIMIT");
    }
  }, { timeout: 10000 });
}

/** Read-only status for an authenticated user's own UI. */
export async function aiQuotaStatus(userId: string) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const nextDay = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const hour = quotaWindowStart(now, "HOUR");
  const nextHour = new Date(hour.getTime() + 60 * 60 * 1000);
  const month = quotaWindowStart(now, "MONTH");
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const [user, subscription, windows] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isSubscribed: true, generationCount: true, lastGeneratedAt: true } }),
    prisma.subscription.findUnique({ where: { userId }, select: { plan: true, status: true } }),
    prisma.aiQuotaWindow.findMany({ where: { key: { in: [quotaWindowKey(userId, "HOUR", hour), quotaWindowKey(userId, "MONTH", month)] } }, select: { period: true, requests: true, credits: true } }),
  ]);
  if (!user) throw new ProfileError(401, "UNAUTHORIZED");
  const plan = resolveAIQuotaPlan(subscription, user.isSubscribed);
  const limits = aiQuotaLimits(plan, process.env);
  const usedDaily = user.lastGeneratedAt && user.lastGeneratedAt >= start ? user.generationCount : 0;
  const usedHour = windows.find(row => row.period === "HOUR")?.requests || 0;
  const usedMonthlyCredits = windows.find(row => row.period === "MONTH")?.credits || 0;
  return {
    plan,
    units: "operations_and_workload_credits_not_usd",
    daily: { limit: limits.daily, used: usedDaily, remaining: Math.max(0, limits.daily - usedDaily), resetsAt: nextDay.toISOString() },
    hourly: { limit: limits.hourly, used: usedHour, remaining: Math.max(0, limits.hourly - usedHour), resetsAt: nextHour.toISOString() },
    monthlyCredits: { limit: limits.monthlyCredits, used: usedMonthlyCredits, remaining: Math.max(0, limits.monthlyCredits - usedMonthlyCredits), resetsAt: nextMonth.toISOString() },
  };
}
