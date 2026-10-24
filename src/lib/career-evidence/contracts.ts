/** Strictly bounded personal facts. Labels are provenance, not proof. */
export const EVIDENCE_KINDS = [
  "SKILL", "EXPERIENCE", "EDUCATION", "PROJECT", "CERTIFICATION",
  "ACHIEVEMENT", "LANGUAGE", "OTHER",
] as const;
export const EVIDENCE_STATUSES = ["DRAFT", "CONFIRMED", "REJECTED", "REVOKED"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];
export type EvidenceAction = "confirm" | "reject" | "revoke";

/** No untrusted caller may set the provenance of a manual fact to AI/PROFILE. */
export function nextEvidenceStatus(current: EvidenceStatus, action: EvidenceAction): EvidenceStatus | null {
  if (action === "confirm") return current === "DRAFT" || current === "REJECTED" ? "CONFIRMED" : null;
  if (action === "reject") return current === "DRAFT" ? "REJECTED" : null;
  if (action === "revoke") return current === "CONFIRMED" ? "REVOKED" : null;
  return null;
}

/** User correction invalidates earlier confirmation, even for cosmetic edits. */
export function statusAfterEdit(current: EvidenceStatus): EvidenceStatus | null {
  return current === "REVOKED" ? null : "DRAFT";
}
