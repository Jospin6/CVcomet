/** Shared instruction for future optional LLM enrichment. The current graph
 * intentionally uses no external LLM: skill coverage is deterministic, sourced
 * from existing user documents; arbitrary AI narratives are not persisted. */
export const CAREER_MAP_EVIDENCE_POLICY = [
  "Use only authenticated user's saved profile and explicitly selected, owned CV.",
  "Career objectives, desired job titles, and interests are wishes, not verified qualifications.",
  "Mark skills only when mentioned in allowed skill, experience, project or certification fields.",
  "Percentages mean catalog keyword coverage, never probability of hiring or future compensation.",
  "Do not invent vacancies, salary expectations, licenses, skills, certificates or experience.",
  "Career goals require explicit user action; never submit applications or edit CV automatically.",
].join(" ");
