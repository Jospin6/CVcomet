import { resumeConversationFields } from "@/lib/resume-conversation";
import type { ResumeAgentInput, ResumeAgentPlan } from "../agent/state";

/** Deterministic routing, not an LLM guessing whether a job exists. */
export function planResumeEdit(input: ResumeAgentInput): ResumeAgentPlan {
  const allowed = new Set(resumeConversationFields(input.document));
  if (input.targetField && !allowed.has(input.targetField)) {
    // The API already checks the selection; fail closed at the agent boundary too.
    throw new Error("INVALID_RESUME_TARGET");
  }
  const text = input.instruction.trim().toLowerCase();
  const jobMentioned = /\b(job|jobs|posting|position|vacancy|role|offre|poste|emploi|candidature|job description)\b/i.test(text);
  const tailoring = /\b(tailor|adapt|align|personnalis|ajust|match|optimis|fit)\w*/i.test(text);
  if (jobMentioned && tailoring && !input.linkedJobAdvert) {
    return {
      mode: "clarification",
      message: input.language === "fr"
        ? "Associez d'abord une offre d'emploi au CV pour que je puisse l'adapter sans inventer d'exigences."
        : "Link a job posting to the resume before tailoring it to that role.",
    };
  }
  if (input.targetField) return { mode: "focused", targetField: input.targetField };
  return { mode: jobMentioned && tailoring ? "tailor" : "general" };
}
