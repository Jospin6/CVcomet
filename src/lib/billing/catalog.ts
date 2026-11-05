import { aiQuotaLimits, type AIQuotaPlan } from "../ai/quota-policy.ts";

export const BILLING_PLANS = ["FREE", "PRO", "CAREER_PRO"] as const;
export type BillingPlan = typeof BILLING_PLANS[number];

/** Product benefits must not imply unlocked endpoints without a corresponding authorization check. */
export function planCatalog(env: Record<string, string | undefined> = {}) {
  return BILLING_PLANS.map(plan => ({
    key: plan,
    label: plan === "CAREER_PRO" ? "Career Pro" : plan === "PRO" ? "Pro" : "Free",
    aiQuota: aiQuotaLimits(plan as AIQuotaPlan, env),
    included: plan === "FREE"
      ? ["CV creation", "Career dashboard", "AI assistance within free limits"]
      : plan === "PRO"
        ? ["Higher daily AI limits", "More monthly workload credits", "Access to career workflows under plan limits"]
        : ["Highest daily AI allowances", "Largest monthly workload budget", "Career tools under plan limits"],
  }));
}

export type StripePriceInfo = {
  id: string;
  active: boolean;
  currency: string;
  type: string;
  unit_amount: number | null;
  recurring: { interval: string; interval_count: number } | null;
};

/** Only active, fixed-amount recurring prices are safe to display for checkout. */
export function publicPrice(price: StripePriceInfo | null | undefined) {
  if (!price || !price.active || price.type !== "recurring" || !price.recurring ||
      !["day", "week", "month", "year"].includes(price.recurring.interval) ||
      !Number.isSafeInteger(price.recurring.interval_count) || price.recurring.interval_count < 1 || price.recurring.interval_count > 12 ||
      !/^[a-z]{3}$/.test(price.currency) || !Number.isSafeInteger(price.unit_amount) ||
      (price.unit_amount as number) < 0 || !price.id.startsWith("price_")) return null;
  return {
    currency: price.currency.toUpperCase(),
    amountMinor: price.unit_amount as number,
    interval: price.recurring.interval,
    intervalCount: price.recurring.interval_count,
  };
}

/** Stripe amounts are in currency minor units (some currencies have 0/3 decimals). */
export function formattedPrice(price: ReturnType<typeof publicPrice>, locale = "en-US") {
  if (!price) return null;
  try {
    const fmt = new Intl.NumberFormat(locale, { style: "currency", currency: price.currency });
    const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
    return fmt.format(price.amountMinor / 10 ** digits);
  } catch { return null; }
}
