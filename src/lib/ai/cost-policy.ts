/**
 * Optional, explicit provider tariffs; no model pricing is assumed or hard-coded.
 * AI_MODEL_COSTS_JSON example:
 * {"OPENAI":{"gpt-4.1-mini":{"inputUSDPerMillion":0.4,"outputUSDPerMillion":1.6}}}
 * These are operator-supplied estimates, not Stripe charges or provider invoices.
 */
export type ModelRate = { inputUSDPerMillion: number; outputUSDPerMillion: number };
export type ModelRateTable = Record<string, Record<string, ModelRate>>;

function rate(value: unknown): value is ModelRate {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return [obj.inputUSDPerMillion, obj.outputUSDPerMillion].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1000);
}

/** Malformed rate tables never cause silent invented dollar amounts. */
export function parseModelRates(raw: string | undefined): ModelRateTable {
  if (!raw || raw.length > 32000) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: ModelRateTable = {};
    for (const [provider, models] of Object.entries(parsed)) {
      if (!/^[A-Z]{2,20}$/.test(provider) || !models || typeof models !== "object" || Array.isArray(models)) continue;
      for (const [model, value] of Object.entries(models)) {
        if (!/^[\w.\-\/]{1,100}$/.test(model) || ["__proto__", "constructor", "prototype"].includes(model) || !rate(value)) continue;
        (out[provider] ??= {})[model] = value;
      }
    }
    return out;
  } catch { return {}; }
}

export function estimatedModelCostUSD(
  rates: ModelRateTable, provider: string, model: string,
  inputTokens: number | undefined, outputTokens: number | undefined,
): number | null {
  const tariff = rates[provider]?.[model];
  if (!tariff || ![inputTokens, outputTokens].every(v => Number.isSafeInteger(v) && (v as number) >= 0)) return null;
  const cost = ((inputTokens as number) * tariff.inputUSDPerMillion + (outputTokens as number) * tariff.outputUSDPerMillion) / 1_000_000;
  return Number.isFinite(cost) && cost <= 1e8 ? Number(cost.toFixed(6)) : null;
}
