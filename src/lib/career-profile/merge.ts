import type { ProfileData } from "./schema";

/** Only facts from a resume may be proposed. Career preferences and account email
 * are explicit user choices, never inferred from an uploaded document. */
const importableFields = [
  "name", "phone", "address", "headline", "summary", "skills", "languages",
  "hobbies", "linkedin", "github", "portfolio",
] as const;
const collections = [
  "experiences", "education", "projects", "certifications", "awards", "professionalLinks",
] as const;
type Collection = (typeof collections)[number];
type ImportField = (typeof importableFields)[number];

export type ProfileImportReview = Readonly<{
  status: "requires_confirmation";
  addedFields: readonly string[];
  addedRecords: Readonly<Partial<Record<Collection, number>>>;
  conflicts: readonly Readonly<{ field: string; kind: "existing_value" | "possible_duplicate" }>[];
  incompleteRecords: Readonly<Partial<Record<Collection, number>>>;
  ignoredDuplicates: Readonly<Partial<Record<Collection, number>>>;
  unverifiedFields?: readonly string[];
  evidenceMode?: "text_verified" | "native_pdf_review";
}>;

type Row = Record<string, unknown>;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const comparable = (value: unknown) => text(value).normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ");
const fieldsForIdentity: Record<Collection, readonly string[]> = {
  experiences: ["title", "company", "start"],
  education: ["degree", "school", "start"],
  projects: ["title", "start"],
  certifications: ["name", "organization", "date"],
  awards: ["title", "organization", "date"],
  professionalLinks: ["url"],
};
const requiredLabel: Record<Collection, string> = {
  experiences: "title", education: "degree", projects: "title",
  certifications: "name", awards: "title", professionalLinks: "url",
};
function canonical(row: Row): string {
  return JSON.stringify(Object.keys(row).filter(key => key !== "id").sort()
    .map(key => [key, typeof row[key] === "string" ? comparable(row[key]) : row[key]]));
}
function identity(collection: Collection, row: Row): string {
  return fieldsForIdentity[collection].map(key => comparable(row[key])).join("\u001f");
}

/**
 * Deterministic draft-only reconciliation. Never overwrites a nonempty fact,
 * never changes verified account email or job preferences, preserves owned IDs,
 * and does not append records with missing required labels. Near duplicates are
 * surfaced for review rather than silently duplicated or overwritten.
 */
export function reconcileExtractedProfile(
  current: ProfileData,
  extracted: Partial<ProfileData>,
): { proposal: ProfileData; review: ProfileImportReview } {
  const proposal: ProfileData = {
    ...current,
    experiences: [...current.experiences], education: [...current.education],
    projects: [...current.projects], certifications: [...current.certifications],
    awards: [...current.awards], professionalLinks: [...current.professionalLinks],
    jobPreferences: { ...current.jobPreferences },
  };
  const addedFields: string[] = [];
  const conflicts: Array<{ field: string; kind: "existing_value" | "possible_duplicate" }> = [];
  const addedRecords: Partial<Record<Collection, number>> = {};
  const incompleteRecords: Partial<Record<Collection, number>> = {};
  const ignoredDuplicates: Partial<Record<Collection, number>> = {};

  for (const key of importableFields) {
    const incoming = text(extracted[key]);
    if (!incoming) continue;
    if (!text(current[key])) {
      proposal[key] = incoming;
      addedFields.push(key);
    } else if (comparable(current[key]) !== comparable(incoming)) {
      conflicts.push({ field: key, kind: "existing_value" });
    }
  }
  // Email is a verified account field and must not be changed by CV import.
  if (text(extracted.email) && comparable(extracted.email) !== comparable(current.email)) {
    conflicts.push({ field: "email", kind: "existing_value" });
  }

  for (const collection of collections) {
    const existing = proposal[collection] as unknown as Row[];
    const incoming = Array.isArray(extracted[collection]) ? extracted[collection] as unknown as Row[] : [];
    const fingerprints = new Set(existing.map(canonical));
    const identities = new Set(existing.map(item => identity(collection, item)));
    let added = 0;
    for (const row of incoming) {
      if (!row || typeof row !== "object" || !text(row[requiredLabel[collection]]) ||
          (collection === "professionalLinks" && !text(row.label))) {
        incompleteRecords[collection] = (incompleteRecords[collection] || 0) + 1;
        continue;
      }
      const fingerprint = canonical(row);
      if (fingerprints.has(fingerprint)) {
        ignoredDuplicates[collection] = (ignoredDuplicates[collection] || 0) + 1;
        continue;
      }
      const key = identity(collection, row);
      if (identities.has(key)) {
        conflicts.push({ field: collection, kind: "possible_duplicate" });
        continue;
      }
      // Extracted records have no trusted database ID: never copy a foreign ID.
      const { id: _untrustedId, ...withoutId } = row;
      void _untrustedId;
      existing.push(withoutId);
      identities.add(key);
      fingerprints.add(fingerprint);
      added += 1;
    }
    if (added) addedRecords[collection] = added;
  }

  return {
    proposal,
    review: {
      status: "requires_confirmation", addedFields, addedRecords,
      conflicts, incompleteRecords, ignoredDuplicates,
    },
  };
}
