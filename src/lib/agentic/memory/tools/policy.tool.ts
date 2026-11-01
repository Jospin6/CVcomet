/** Stage 17: explicit, bounded, opt-in career preferences. No transcript/document ingestion. */
export const MEMORY_KEYS = [
  "response_language", "response_style", "target_role", "target_country",
  "target_industry", "work_mode", "cv_market",
] as const;
export type MemoryKey = typeof MEMORY_KEYS[number];

// ATS and job-match evidence must come ONLY from their dedicated sources.
// Voice requires an independent LiveKit consent and cannot inherit this memory.
export const MEMORY_AGENTS = ["supervisor", "resume", "cover_letter"] as const;
export type MemoryAgent = typeof MEMORY_AGENTS[number];
export type MemoryPreferenceInput = Readonly<{
  key: MemoryKey;
  value: string;
  allowedAgents: readonly MemoryAgent[];
}>;

const fields = new Set<string>(MEMORY_KEYS);
const scopes = new Set<string>(MEMORY_AGENTS);
const unsafe = /[\u0000-\u001f\u007f<>]|https?:\/\/|www\.|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

export function assertMemoryPreference(input: unknown): MemoryPreferenceInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("MEMORY_INVALID");
  const data = input as Record<string, unknown>;
  if (Object.keys(data).sort().join("|") !== "allowedAgents|key|value" ||
      typeof data.key !== "string" || !fields.has(data.key) ||
      typeof data.value !== "string") throw Error("MEMORY_INVALID");
  const value = data.value.trim();
  if (value.length < 1 || value.length > 120 || unsafe.test(value) || /\s{3,}/.test(value)) throw Error("MEMORY_INVALID");
  if (!Array.isArray(data.allowedAgents) || data.allowedAgents.length < 1 || data.allowedAgents.length > MEMORY_AGENTS.length ||
      data.allowedAgents.some(agent => typeof agent !== "string" || !scopes.has(agent)) ||
      new Set(data.allowedAgents).size !== data.allowedAgents.length) throw Error("MEMORY_INVALID");
  return { key: data.key as MemoryKey, value, allowedAgents: [...data.allowedAgents] as MemoryAgent[] };
}

export function visibleToAgent(allowedAgents: readonly string[], agent: string): boolean {
  return scopes.has(agent) && allowedAgents.includes(agent);
}

export function selectAgentPreferences<T extends { key: string; value: string; allowedAgents: string[] }>(
  entries: readonly T[], agent: string,
): Pick<T, "key" | "value">[] {
  if (!scopes.has(agent)) return [];
  const seen = new Set<string>();
  return entries.filter(e => fields.has(e.key) && visibleToAgent(e.allowedAgents, agent))
    .filter(e => { if (seen.has(e.key)) return false; seen.add(e.key); return true; })
    .slice(0, MEMORY_KEYS.length).map(({ key, value }) => ({ key, value: value.slice(0, 120) }));
}
