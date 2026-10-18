export type FeatureKey = "RESUME_AI" | "ATS_ADVANCED" | "JOB_MATCH" | "RESUME_TAILOR" | "COVER_LETTER" | "INTERVIEW_AI" | "CAREER_AGENT" | "ADVANCED_ANALYTICS";
export type CareerPlan = "FREE" | "PRO" | "CAREER_PRO";
const access: Record<CareerPlan, FeatureKey[]> = {
  FREE: ["RESUME_AI"],
  PRO: ["RESUME_AI", "ATS_ADVANCED", "JOB_MATCH", "RESUME_TAILOR", "COVER_LETTER"],
  CAREER_PRO: ["RESUME_AI", "ATS_ADVANCED", "JOB_MATCH", "RESUME_TAILOR", "COVER_LETTER", "INTERVIEW_AI", "CAREER_AGENT", "ADVANCED_ANALYTICS"],
};
export function canUseFeature(plan: CareerPlan, feature: FeatureKey) { return access[plan].includes(feature); }
export const planFeatures = access;

export async function requireFeature(userId: string, feature: FeatureKey) {
  const { userPlan } = await import("./auth-user");
  const { ProfileError } = await import("@/lib/career-profile/http");
  if (!canUseFeature(await userPlan(userId), feature)) throw new ProfileError(403, "FEATURE_NOT_AVAILABLE");
}
