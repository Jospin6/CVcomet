import type { AgentRunIdentity } from "../contracts.ts";
import { AgenticError } from "../errors.ts";
import { assertRunIdentity } from "../policies/identity.ts";
import type { AIQuotaFeature } from "../../../ai/quota-policy";

const ALLOWED_FEATURES: ReadonlySet<AIQuotaFeature> = new Set([
  "GENERAL", "CONVERSATION_TITLE", "CAREER_ASSISTANT", "RESUME_GENERATION",
  "RESUME_EDIT", "COVER_LETTER", "APPLICATION_EMAIL", "CAREER_PROFILE",
  "PROFILE_IMPORT", "LINKEDIN_IMPORT", "JOB_ANALYSIS", "RESUME_TAILOR",
  "ATS_REVIEW", "INTERVIEW_PREPARATION",
]);

export type AgentModelRequest = Readonly<{
  feature: AIQuotaFeature;
  system: string;
  prompt: string;
  maxTokens?: number;
}>;

/** A model call is a billable operation; no anonymous calls or unbounded prompts. */
export function validateModelRequest(identity: AgentRunIdentity, request: AgentModelRequest): {
  actorId: string;
  feature: AIQuotaFeature;
  system: string;
  prompt: string;
  maxTokens: number;
} {
  assertRunIdentity(identity);
  if (identity.access.kind !== "authenticated") throw new AgenticError("AGENT_ACCESS_DENIED", 403);
  const maxTokens = request?.maxTokens ?? 2048;
  if (!request || !ALLOWED_FEATURES.has(request.feature) ||
      typeof request.system !== "string" || request.system.length < 1 || request.system.length > 8_000 ||
      typeof request.prompt !== "string" || request.prompt.length < 1 || request.prompt.length > 60_000 ||
      !Number.isSafeInteger(maxTokens) || maxTokens < 128 || maxTokens > 6_000) {
    throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400);
  }
  return {
    actorId: identity.access.actorId, feature: request.feature, system: request.system,
    prompt: request.prompt, maxTokens,
  };
}
