import type { CareerMapState } from "../agent/state";
/** Only non-sensitive metadata is saved as a map snapshot. */
export function careerMapContextNode(state: typeof CareerMapState.State) {
  const { profile, cv } = state.input;
  return { snapshot: {
    name: profile.name ?? "", headline: profile.headline ?? "",
    experienceLevel: profile.experienceLevel ?? "", sourceCvTitle: cv?.title ?? null,
    skillSource: cv ? "profile-and-selected-resume" as const : "profile" as const,
  } };
}
