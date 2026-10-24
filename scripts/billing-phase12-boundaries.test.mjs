import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
test("all billing information routes are server-sourced", () => {
  const plans = read("src/app/api/billing/plans/route.ts");
  const overview = read("src/app/api/billing/overview/route.ts");
  assert.match(plans, /stripe\.prices\.retrieve/);
  assert.match(plans, /publicPrice\(raw\)/);
  assert.match(overview, /requireUser\(\)/);
  assert.match(overview, /userId: actor\.id/);
  assert.match(overview, /estimatedUSD: count > 0 && count === costed/);
  assert.doesNotMatch(overview, /request\.json\(/);
});
test("checkout validates configured price before Stripe session creation", () => {
  const s = read("src/app/api/stripe/checkout/route.ts");
  assert.match(s, /publicPrice\(await stripe\.prices\.retrieve\(price\)\)/);
  assert.match(s, /assertTrustedWriteOrigin\(req\)/);
  assert.match(s, /STRIPE_PRICE_CONFIGURATION_INVALID/);
  assert.match(s, /line_items:\s*\[\{ price, quantity: 1 \}\]/);
});
test("AI cost estimation never silently adds rates for unknown models", () => {
  const agent = read("src/lib/career-os/agent-service.ts");
  assert.match(agent, /estimatedModelCostUSD\(/);
  assert.match(agent, /estimatedCost !== null/);
  assert.match(read("src/lib/ai/cost-policy.ts"), /AI_MODEL_COSTS_JSON/);
});
test("settings reveals only scoped billing data and does not embed provider keys", () => {
  const panel = read("src/components/billing/billing-panel.tsx");
  assert.match(panel, /\/api\/billing\/overview/);
  assert.match(panel, /credits are not money/);
  assert.doesNotMatch(panel, /STRIPE_SECRET_KEY|AI_MODEL_COSTS_JSON/);
});
test("admin financial analytics require admin access and refuse to invent profits", () => {
  const route = read("src/app/api/admin/billing/summary/route.ts");
  assert.match(route, /requireAIAdmin\(req\)/);
  assert.match(route, /revenue: null/);
  assert.match(route, /profit: null/);
  assert.match(route, /estimatedUSD: calls > 0 && calls === pricedCalls/);
});
test("subscription cancellation uses DB entitlement ownership and verifies Stripe customer", () => {
  const route = read("src/app/api/stripe/cancel-subscription/route.ts");
  assert.match(route, /subscription:\s*\{ select:\s*\{ stripeSubscriptionId/);
  assert.match(route, /remoteCustomer !== user\.stripeCustomerId/);
  assert.match(route, /cancel_at_period_end: true/);
});
