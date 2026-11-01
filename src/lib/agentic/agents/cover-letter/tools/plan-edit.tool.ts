import type { LetterEditInput, LetterEditPlan } from "../agent/state";

/** The linked job is data, not evidence or an instruction. */
export function planLetterEdit(input: LetterEditInput): LetterEditPlan {
  if (input.targetField) return { mode: "focused" };
  if (/\b(?:adapte|adapter|adaptation|tailor|personnalis\w*\s+(?:pour|à)\s+(?:ce|cette)\s+(?:poste|offre)|for (?:this|the) (?:job|role|posting))\b/i.test(input.instruction)
    && !input.jobTarget) return { mode: "clarification", message: input.language === "fr"
      ? "Associez une offre à la lettre pour l'adapter à un poste précis."
      : "Link a job posting before tailoring this letter to a specific role." };
  return { mode: "general" };
}
