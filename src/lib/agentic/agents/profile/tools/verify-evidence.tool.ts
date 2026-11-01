import type { ExtractedProfile } from "../agent/state";

/** Evidence checks are conservative: missing anchors are omitted from the
 * automatic proposal, not guessed or silently persisted. The source never
 * leaves the request. Native scanned PDFs have no searchable extracted text;
 * those receive a model-only review warning instead. */
export function verifyExtractedEvidence(extracted: ExtractedProfile, sourceText: string): {
  verified: ExtractedProfile;
  unverifiedFields: readonly string[];
  evidenceMode: "text_verified" | "native_pdf_review";
} {
  if (!sourceText.trim()) return {
    verified: extracted, unverifiedFields: [], evidenceMode: "native_pdf_review",
  };
  const normalized = (value: string) => value.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
  const source = normalized(sourceText.slice(0, 55_000));
  const found = (value: unknown) => typeof value === "string" && (!value.trim() || source.includes(normalized(value)));
  const verified: ExtractedProfile = {
    ...extracted,
    experiences: [...extracted.experiences], education: [...extracted.education],
    projects: [...extracted.projects], certifications: [...extracted.certifications],
    awards: [...extracted.awards], professionalLinks: [...extracted.professionalLinks],
  };
  const unverifiedFields: string[] = [];

  // Some generated labels are paraphrased. Check names and verifiable anchors;
  // leave summaries/headlines for explicit manual review rather than declaring
  // their exact wording missing.
  if (verified.name && !found(verified.name)) {
    verified.name = "";
    unverifiedFields.push("name");
  }
  for (const field of ["linkedin", "github", "portfolio"] as const) {
    // Link formatting may differ (https:// prefix); compare recognizable paths.
    const value = verified[field];
    if (value && !source.includes(normalized(value.replace(/^https?:\/\//i, "")))) {
      verified[field] = "";
      unverifiedFields.push(field);
    }
  }
  const skillItems = verified.skills.split(/[,;\n|]+/).map(s => s.trim()).filter(Boolean);
  if (skillItems.length) {
    const supported = skillItems.filter(found);
    if (supported.length !== skillItems.length) unverifiedFields.push("skills");
    verified.skills = supported.join(", ");
  }

  for (const [key, anchors] of [
    ["experiences", ["company", "title"]],
    ["education", ["school", "degree"]],
    ["projects", ["title"]],
    ["certifications", ["organization", "name"]],
    ["awards", ["organization", "title"]],
  ] as const) {
    const records = verified[key];
    const kept = records.filter((item) => {
      const row = item as unknown as Record<string, unknown>;
      // The first available strong anchor is sufficient. Missing labels are
      // handled separately by reconciliation and presented as incomplete.
      const anchor = anchors.find(field => typeof row[field] === "string" && (row[field] as string).trim());
      return !anchor || found(row[anchor]);
    });
    if (kept.length !== records.length) unverifiedFields.push(key);
    // All record groups are arrays of their own distinct type; preserve the
    // source schema and do not turn unknown records into saved facts.
    (verified as unknown as Record<string, unknown>)[key] = kept;
  }
  return { verified, unverifiedFields, evidenceMode: "text_verified" };
}
