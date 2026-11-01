import type { AgentRunIdentity } from "../../../core/contracts.ts";
import { AgenticError } from "../../../core/errors.ts";
import type { ResumeFieldInput } from "../agent/field-state";
import { resumeFieldInstructions } from "../prompts/resume-field.prompt";

export type FieldModel = (identity: AgentRunIdentity, request: {
  feature: "RESUME_EDIT"; system: string; prompt: string; maxTokens: number;
}, signal: AbortSignal) => Promise<string>;

/** Model is routed through the existing CVComet provider & quota gateway. */
export async function generateResumeFieldTool(
  identity: AgentRunIdentity, input: ResumeFieldInput, prompt: string,
  signal: AbortSignal, provider?: FieldModel,
) {
  if (identity.agentId !== "resume" || identity.access.kind !== "authenticated") {
    throw new AgenticError("AGENT_ACCESS_DENIED", 403);
  }
  const call = provider ?? (await import("../../../core/models/cvcomet-ai-sdk")).cvcometAgentModel.text;
  return call(identity, {
    feature: "RESUME_EDIT",
    system: input.systemPolicy + "\n" + resumeFieldInstructions,
    prompt,
    maxTokens: 1800,
  }, signal);
}
