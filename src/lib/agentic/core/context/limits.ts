/** Generic, deterministic bounds for ephemeral AI context. No domain knowledge here. */
export const MAX_MODEL_CONTEXT_CHARS = 30_000;

export function boundedText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function boundedStrings(value: unknown, count: number, length: number): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
      .slice(0, count).map((entry) => boundedText(entry, length))
    : [];
}

export function boundedRecords(value: unknown, count: number): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
      item !== null && typeof item === "object" && !Array.isArray(item)).slice(0, count)
    : [];
}

/** Only an allowlisted projection can be serialized; never stringify Prisma records. */
export function boundedModelContext(value: unknown): string {
  const encoded = JSON.stringify(value);
  if (!encoded || encoded.length > MAX_MODEL_CONTEXT_CHARS) {
    throw new Error("AGENT_CONTEXT_LIMIT_EXCEEDED");
  }
  return encoded;
}
