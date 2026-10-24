import test from "node:test";
import assert from "node:assert/strict";
import { planCatalog, publicPrice, formattedPrice } from "../src/lib/billing/catalog.ts";
import { parseModelRates, estimatedModelCostUSD } from "../src/lib/ai/cost-policy.ts";

const goodPrice = { id: "price_123", active: true, type: "recurring", currency: "usd", unit_amount: 1299,
  recurring: { interval: "month", interval_count: 1 } };

test("catalog has exactly three plans with finite limits and no hardcoded paid prices", () => {
  const plans = planCatalog();
  assert.deepEqual(plans.map(p=>p.key), ["FREE", "PRO", "CAREER_PRO"]);
  assert.ok(plans[0].aiQuota.daily < plans[2].aiQuota.daily);
  assert.ok(JSON.stringify(plans).indexOf("$12") === -1);
});

test("only active fixed-rate subscriptions can be displayed", () => {
  assert.deepEqual(publicPrice(goodPrice), { currency: "USD", amountMinor: 1299, interval: "month", intervalCount: 1 });
  for (const variant of [
    { ...goodPrice, active: false }, { ...goodPrice, id: "bad" }, { ...goodPrice, type: "one_time" },
    { ...goodPrice, unit_amount: null }, { ...goodPrice, unit_amount: -1 },
    { ...goodPrice, currency: "USDD" }, { ...goodPrice, recurring: null },
    { ...goodPrice, recurring: { interval: "decade", interval_count: 1 } },
    { ...goodPrice, recurring: { interval: "month", interval_count: 0 } },
    { ...goodPrice, recurring: { interval: "month", interval_count: 1.5 } },
  ]) assert.equal(publicPrice(variant), null);
});

test("minor units use currency-specific decimal precision", () => {
  assert.equal(formattedPrice(publicPrice(goodPrice), "en-US"), "$12.99");
  assert.match(formattedPrice(publicPrice({...goodPrice,currency:"jpy",unit_amount:1200}), "en-US"), /1,200/);
  assert.equal(formattedPrice(null), null);
});

test("provider tariffs are operator-defined, not invented", () => {
  assert.deepEqual(parseModelRates(undefined), {});
  assert.deepEqual(parseModelRates("not json"), {});
  assert.deepEqual(parseModelRates("[]"), {});
  assert.equal(estimatedModelCostUSD({}, "OPENAI", "test", 1000, 2000), null);
  assert.equal(estimatedModelCostUSD(parseModelRates('{"OPENAI":{"test":{"inputUSDPerMillion":2,"outputUSDPerMillion":8}}}'), "OPENAI", "test", 1000, 2000), 0.018);
});

test("estimates fail closed when tokens, tariffs, or provider are invalid", () => {
  const t = parseModelRates('{"OPENAI":{"test":{"inputUSDPerMillion":3,"outputUSDPerMillion":9},"other":{"inputUSDPerMillion":-1,"outputUSDPerMillion":9}}}');
  assert.equal(estimatedModelCostUSD(t, "OPENAI", "other", 100, 100), null);
  assert.equal(estimatedModelCostUSD(t, "OTHER", "test", 100, 100), null);
  for (const invalid of [undefined, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(estimatedModelCostUSD(t, "OPENAI", "test", invalid, 20), null);
  }
});

test("malicious rate table keys cannot pollute object prototypes", () => {
  const t = parseModelRates('{"OPENAI":{"__proto__":{"inputUSDPerMillion":1,"outputUSDPerMillion":1},"normal":{"inputUSDPerMillion":1,"outputUSDPerMillion":1}}}');
  assert.equal(Object.prototype.hasOwnProperty.call(t.OPENAI, "__proto__"), false);
  assert.equal(estimatedModelCostUSD(t, "OPENAI", "normal", 1e6, 1e6), 2);
});
