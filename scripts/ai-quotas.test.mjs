import test from "node:test";
import assert from "node:assert/strict";
import {
  aiCredits, aiQuotaLimits, quotaWindowStart, quotaWindowKey, resolveAIQuotaPlan,
} from "../src/lib/ai/quota-policy.ts";

test("Every plan has finite default quotas and higher plans have larger budgets", () => {
  const a = aiQuotaLimits("FREE"), b = aiQuotaLimits("PRO"), c = aiQuotaLimits("CAREER_PRO");
  for (const limits of [a, b, c]) for (const limit of Object.values(limits)) assert.ok(Number.isInteger(limit) && limit > 0);
  assert.ok(a.daily < b.daily && b.daily < c.daily);
  assert.ok(a.monthlyCredits < b.monthlyCredits && b.monthlyCredits < c.monthlyCredits);
});

test("Config reads finite overrides only, and fails closed to defaults", () => {
  const base = aiQuotaLimits("FREE");
  const custom = aiQuotaLimits("FREE", { AI_QUOTA_FREE_DAILY: "6", AI_QUOTA_FREE_HOURLY: "2", AI_QUOTA_FREE_MONTHLY_CREDITS: "50" });
  assert.deepEqual(custom, { daily: 6, hourly: 2, monthlyCredits: 50 });
  for (const raw of ["0", "-1", "Infinity", "999999999", "2.5", "abc", " 1 "]) {
    assert.deepEqual(aiQuotaLimits("FREE", { AI_QUOTA_FREE_DAILY: raw }), base);
  }
});

test("UTC windows are stable independent of local machine timezone", () => {
  const date = new Date("2026-10-24T23:59:59.000-03:00");
  assert.equal(quotaWindowStart(date, "HOUR").toISOString(), "2026-10-25T02:00:00.000Z");
  assert.equal(quotaWindowStart(date, "MONTH").toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(quotaWindowKey("abc", "HOUR", quotaWindowStart(date, "HOUR")), "abc:HOUR:2026-10-25T02:00:00.000Z");
});

test("High-complexity workflows consume more credits than a title", () => {
  assert.equal(aiCredits("CONVERSATION_TITLE"), 1);
  assert.ok(aiCredits("ATS_REVIEW") > aiCredits("CONVERSATION_TITLE"));
  assert.ok(aiCredits("JOB_ANALYSIS") > 0);
});

test("Expired subscription never inherits the legacy paid flag", () => {
  assert.equal(resolveAIQuotaPlan(null, true), "PRO");
  assert.equal(resolveAIQuotaPlan({ plan: "CAREER_PRO", status: "TRIALING" }, false), "CAREER_PRO");
  assert.equal(resolveAIQuotaPlan({ plan: "PRO", status: "PAST_DUE" }, true), "FREE");
  assert.equal(resolveAIQuotaPlan({ plan: "PRO", status: "CANCELED" }, true), "FREE");
});
