/** Data-only review helpers; untrusted model output can NEVER be committed by the browser. */
export function numberTokens(input: string): string[] {
  return input.match(/\d+(?:[.,]\d+)*/g) || [];
}

/** Invariants: a new quantified achievement/date requires an existing user-provided source. */
export function unsupportedNumericClaims(
  edits: ReadonlyArray<{ type: string; value?: string }>,
  candidateSources: ReadonlyArray<string>,
): string[] {
  const allowed = new Set(candidateSources.flatMap(numberTokens));
  return [...new Set(edits.filter(edit => edit.type === "setField")
    .flatMap(edit => numberTokens(edit.value || ""))
    .filter(token => !allowed.has(token)))];
}

/** Return bounded, escaped-by-React text only; paths represent existing editor fields. */
export function reviewChanges(before: unknown, after: unknown, edits: ReadonlyArray<{ type: string; path?: string; changes?: object; section?: string }>) {
  const get = (root: unknown, path: string) => {
    let value: unknown = root;
    for (const segment of path.split(".")) {
      if (value === null || typeof value !== "object") return "";
      value = (value as Record<string, unknown>)[segment];
    }
    return Array.isArray(value) ? value.join("\n") : typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
  };
  const seen = new Set<string>();
  const result: { field: string; before: string; after: string }[] = [];
  for (const edit of edits) {
    const paths = edit.type === "setField" && edit.path ? [edit.path]
      : edit.type === "updateDesign" ? Object.keys(edit.changes || {}).map(key => "design." + key)
      : edit.section ? ["design.sectionOrder", "design.hiddenSections"] : [];
    for (const path of paths) {
      if (seen.has(path)) continue;
      seen.add(path);
      const previous = get(before, path), next = get(after, path);
      if (previous !== next) result.push({ field: path, before: previous.slice(0, 8000), after: next.slice(0, 8000) });
    }
  }
  return result.slice(0, 20);
}

export function proposalIsApplicable(status: string, expiresAt: Date, baseRevision: number, currentRevision: number, now: Date) {
  return status === "PENDING" && expiresAt.getTime() > now.getTime() && baseRevision === currentRevision;
}
