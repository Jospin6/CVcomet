/** Pure, bounded dashboard projections. These must not infer activity from missing API data. */
export type CareerNextStep = "SIGN_IN" | "CREATE_RESUME" | "REVIEW_MATCH" | "PREPARE_PACKET" | "UNAVAILABLE";
export function safeCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
export function applicationCount(raw: unknown): number | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return safeCount((raw as Record<string, unknown>).total);
}
export function missionCount(raw: unknown): number | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = (raw as Record<string, unknown>).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const items = (data as Record<string, unknown>).items;
  return Array.isArray(items) && items.length <= 30 ? items.length : null;
}
export function chooseCareerNextStep(signedIn: boolean, resumes: number | null, applications: number | null): CareerNextStep {
  if (!signedIn) return "SIGN_IN";
  if (safeCount(resumes) === null) return "UNAVAILABLE";
  if (resumes === 0) return "CREATE_RESUME";
  if (applications !== null && applications > 0) return "PREPARE_PACKET";
  return "REVIEW_MATCH";
}
