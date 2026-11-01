import type { LetterCreationInput, CreationPlan } from "../agent/creation-state";
export function planLetterCreation(input: LetterCreationInput): CreationPlan {
  if (!input.facts.trim()) return { ready: false, reason: "AI_FACTS_REQUIRED" };
  if (!input.job.title.trim() || !input.job.description.trim()) return { ready: false, reason: "JOB_REQUIRED" };
  return { ready: true };
}
