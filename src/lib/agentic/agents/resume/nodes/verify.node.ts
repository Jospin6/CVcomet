import { ZodError } from "zod";
import { AgenticError } from "../../../core/errors.ts";
import { ResumeConversationEditError } from "@/lib/resume-conversation";
import type { ResumeAgentState } from "../agent/state";
import { verifyResumeEdit } from "../tools/verify-edit.tool";

export function verifyResumeNode(state: typeof ResumeAgentState.State) {
  if (!state.input || !state.draft) throw new Error("RESUME_DRAFT_REQUIRED");
  try {
    return { result: verifyResumeEdit(state.input, state.draft) };
  } catch (error) {
    if (error instanceof ZodError || error instanceof ResumeConversationEditError) {
      throw new AgenticError("AGENT_MODEL_INVALID_RESPONSE", 502);
    }
    throw error;
  }
}
