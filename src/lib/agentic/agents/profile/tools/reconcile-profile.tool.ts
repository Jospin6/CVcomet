import { profileDataSchema, type CareerProfile } from "@/lib/career-profile/schema";
import { reconcileExtractedProfile } from "@/lib/career-profile/merge";
import type { ExtractedProfile } from "../agent/state";

export function reconcileProfileTool(current: CareerProfile, extracted: ExtractedProfile) {
  const { revision: _revision, onboardingCompletedAt: _onboardingCompletedAt, ...profile } = current;
  void _revision;
  void _onboardingCompletedAt;
  const { proposal, review } = reconcileExtractedProfile(profile, extracted);
  // Prevent a model output from becoming an invalid profile or carrying extra keys.
  return { proposal: profileDataSchema.parse(proposal), review };
}
