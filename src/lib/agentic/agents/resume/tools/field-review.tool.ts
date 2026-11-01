import { unsupportedNumericClaims } from "@/lib/resume-ai/review";
import type { ResumeFieldInput } from "../agent/field-state";

/** No fabricated quantified achievements; never trust LLM output before review. */
export function checkGeneratedResumeField(input: ResumeFieldInput, draft: string) {
  if (typeof draft !== "string") return { proposal: "", issue: "AI_INVALID_RESPONSE" as const };
  const proposal = draft.trim().replace(/^```(?:text)?\s*|\s*```$/g, "").trim().slice(0, 8000);
  if (!proposal) return { proposal: "", issue: "AI_INVALID_RESPONSE" as const };
  const unsupported = unsupportedNumericClaims([{ type: "setField", value: proposal }], input.candidateSources);
  return unsupported.length ? { proposal: "", issue: "UNSUPPORTED_FACTS" as const } : { proposal };
}
