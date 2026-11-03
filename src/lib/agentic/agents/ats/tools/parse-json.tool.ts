/** Parse a model's JSON text without evaluating code or accepting arbitrary prose as data.
 * Providers may wrap a JSON object in Markdown; the caller must still validate
 * every field and evidence citation with its own Zod/business schema. */
export function parseAtsJsonObject(text: string): unknown {
  if (typeof text !== "string" || !text.trim() || text.length > 120_000) {
    throw new SyntaxError("ATS_JSON_RESPONSE_INVALID");
  }
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const value: unknown = JSON.parse(cleaned);
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  } catch { /* Some providers add a leading explanation. Extract one object. */ }
  let start = -1, depth = 0, inString = false, escaped = false;
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (start < 0) {
      if (char === "{") { start = i; depth = 1; }
      continue;
    }
    if (escaped) { escaped = false; continue; }
    if (char === "\\" && inString) { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === "{") depth++;
    if (char === "}") {
      depth--;
      if (depth === 0) {
        const value: unknown = JSON.parse(cleaned.slice(start, i + 1));
        if (value && typeof value === "object" && !Array.isArray(value)) return value;
        break;
      }
    }
  }
  throw new SyntaxError("ATS_JSON_RESPONSE_INVALID");
}
