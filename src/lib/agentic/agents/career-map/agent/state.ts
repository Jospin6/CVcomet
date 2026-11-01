import { Annotation } from "@langchain/langgraph";
import type { CareerProfile, ProfileData } from "@/lib/career-profile/schema";
import type { CareerMapPreferences } from "../tools/preferences.tool";
import type { CareerEvidence, SelectedCareerResume } from "../tools/evidence.tool";
import type { RankedCareerRole } from "../tools/rank.tool";
import type { CareerMapGraph } from "../tools/roadmap.tool";

export type CareerMapAgentInput = Readonly<{
  profile: CareerProfile | ProfileData;
  cv: SelectedCareerResume | null;
  preferences: CareerMapPreferences;
}>;
export type CareerMapSnapshot = Readonly<{
  name: string; headline: string; experienceLevel: string;
  sourceCvTitle: string | null;
  skillSource: "profile" | "profile-and-selected-resume";
}>;
export type CareerMapAgentResult = Readonly<{
  graph: CareerMapGraph;
  snapshot: CareerMapSnapshot;
}>;

/** Transient graph state; DO NOT add a checkpoint here (personal documents). */
export const CareerMapState = Annotation.Root({
  input: Annotation<CareerMapAgentInput>,
  snapshot: Annotation<CareerMapSnapshot>,
  evidence: Annotation<CareerEvidence[]>,
  ranked: Annotation<RankedCareerRole[]>,
  graph: Annotation<CareerMapGraph>,
  verified: Annotation<boolean>,
  result: Annotation<CareerMapAgentResult>,
});
