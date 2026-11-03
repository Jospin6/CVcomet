import { AgenticError } from "../../../core/errors.ts";
import { ZodError } from "zod";
import { ResumeConversationEditError } from "@/lib/resume-conversation";
import type { AgentRunIdentity } from "../../../core/contracts.ts";
import type { ResumeAgentDraft, ResumeAgentInput, ResumeAgentResult } from "./state";
import type { ResumeAgentDependencies } from "../tools/generate-edit.tool";
import { generateResumeEditTool } from "../tools/generate-edit.tool";
import { planResumeEdit } from "../tools/plan-edit.tool";
import { clarifyResume, verifyResumeEdit } from "../tools/verify-edit.tool";

/**
 * Explicit, deterministic recovery for a LangGraph *orchestration* failure.
 * It runs the very same plan/generate/verify rules as the graph; this is not
 * an alternate AI writer and cannot mutate or save a resume.
 *
 * A previously generated draft is reused, so review/graph failures don't
 * charge a second AI call. If generation already started but never produced
 * a draft, the caller MUST NOT invoke this fallback.
 */
export async function resumeEditorDirectFallback(options: {
  identity: AgentRunIdentity;
  input: ResumeAgentInput;
  deps: ResumeAgentDependencies;
  signal: AbortSignal;
  existingDraft?: ResumeAgentDraft;
}): Promise<ResumeAgentResult> {
  if (options.signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
  const plan = planResumeEdit(options.input);
  if (plan.mode === "clarification") return clarifyResume(plan.message || "Please clarify the request.");
  const draft = options.existingDraft ?? await generateResumeEditTool(
    options.identity, options.input, options.deps, options.signal,
  );
  if (options.signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
  let verified: ResumeAgentResult;
  try {
    verified = verifyResumeEdit(options.input, draft);
  } catch (error) {
    if (error instanceof ZodError || error instanceof ResumeConversationEditError) {
      throw new AgenticError("AGENT_MODEL_INVALID_RESPONSE", 502);
    }
    throw error;
  }
  if (verified.object.status === "applied" && !verified.document) {
    throw new AgenticError("AGENT_MODEL_INVALID_RESPONSE", 502);
  }
  return verified;
}
