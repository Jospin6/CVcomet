/** Monetary costs vary by model; these are conservative internal request credits, NOT USD. */
export type AIQuotaPlan = "FREE" | "PRO" | "CAREER_PRO";
export type AIQuotaFeature =
  | "GENERAL" | "CONVERSATION_TITLE" | "CAREER_ASSISTANT" | "RESUME_GENERATION"
  | "RESUME_EDIT" | "COVER_LETTER" | "APPLICATION_EMAIL" | "CAREER_PROFILE"
  | "PROFILE_IMPORT" | "LINKEDIN_IMPORT" | "JOB_ANALYSIS" | "RESUME_TAILOR"
  | "ATS_REVIEW" | "INTERVIEW_PREPARATION";

/** Subscription status, not just the denormalized user flag, controls entitlements. */
export function resolveAIQuotaPlan(
  subscription: { plan: AIQuotaPlan; status: string } | null,
  legacyPaid: boolean,
): AIQuotaPlan {
  if (subscription) return subscription.status === "ACTIVE" || subscription.status === "TRIALING" ? subscription.plan : "FREE";
  return legacyPaid ? "PRO" : "FREE";
}

const defaultLimits: Record<AIQuotaPlan, { daily: number; hourly: number; monthlyCredits: number }> = {
  FREE: { daily: 20, hourly: 8, monthlyCredits: 250 },
  PRO: { daily: 120, hourly: 30, monthlyCredits: 2000 },
  CAREER_PRO: { daily: 240, hourly: 50, monthlyCredits: 5500 },
};

const featureCredits: Record<AIQuotaFeature, number> = {
  GENERAL: 3, CONVERSATION_TITLE: 1, CAREER_ASSISTANT: 3,
  RESUME_GENERATION: 5, RESUME_EDIT: 3, COVER_LETTER: 4,
  APPLICATION_EMAIL: 2, CAREER_PROFILE: 2, PROFILE_IMPORT: 4,
  LINKEDIN_IMPORT: 4, JOB_ANALYSIS: 5, RESUME_TAILOR: 5,
  ATS_REVIEW: 7, INTERVIEW_PREPARATION: 4,
};

function positiveBoundedInt(raw: string | undefined, fallback: number, ceiling: number) {
  if (!raw || !/^[1-9]\d*$/.test(raw)) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= ceiling ? value : fallback;
}

/** Invalid configuration fails closed to defaults; no plan has unlimited AI access. */
export function aiQuotaLimits(plan: AIQuotaPlan, env: Record<string, string | undefined> = {}) {
  const defaults = defaultLimits[plan];
  return {
    daily: positiveBoundedInt(env[`AI_QUOTA_${plan}_DAILY`], defaults.daily, 10000),
    hourly: positiveBoundedInt(env[`AI_QUOTA_${plan}_HOURLY`], defaults.hourly, 1000),
    monthlyCredits: positiveBoundedInt(env[`AI_QUOTA_${plan}_MONTHLY_CREDITS`], defaults.monthlyCredits, 1000000),
  };
}
export function aiCredits(feature: AIQuotaFeature): number { return featureCredits[feature]; }

export function quotaWindowStart(now: Date, period: "HOUR" | "MONTH"): Date {
  return period === "HOUR"
    ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()))
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function quotaWindowKey(userId: string, period: "HOUR" | "MONTH", start: Date): string {
  return `${userId}:${period}:${start.toISOString()}`;
}
