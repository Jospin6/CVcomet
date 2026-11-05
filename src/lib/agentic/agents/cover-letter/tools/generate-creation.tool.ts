import type { AgentRunIdentity } from "../../../core/contracts.ts";
import { AgenticError } from "../../../core/errors.ts";
import { coverLetterSchema } from "@/helpers/schema";
import type { LetterCreationInput, CoverLetterDraft } from "../agent/creation-state";
import { letterCreationSystemPrompt, letterCreationUserPrompt } from "../prompts/creation.prompt";

export type LetterCreationModel = (
  identity: AgentRunIdentity,
  request: { feature: "COVER_LETTER"; system: string; prompt: string; maxTokens: number },
  schema: typeof coverLetterSchema,
  signal: AbortSignal,
) => Promise<{ coverLetter: CoverLetterDraft }>;

/** Model prompt in prompts/, LangGraph execution in nodes/, quota through shared CVComet gateway. */
export async function generateLetterCreation(identity: AgentRunIdentity, input: LetterCreationInput,
  signal: AbortSignal, provider?: LetterCreationModel): Promise<CoverLetterDraft> {
  if (identity.agentId !== "cover-letter" || identity.access.kind !== "authenticated") {
    throw new AgenticError("AGENT_ACCESS_DENIED", 403);
  }
  if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
  const request = {
    feature: "COVER_LETTER" as const,
    system: letterCreationSystemPrompt(input),
    prompt: letterCreationUserPrompt(input),
    maxTokens: 3200,
  };
  // Call each model signature separately: the injected model has a specific
  // Zod schema, while the CVComet gateway exposes a generic object method.
  const response = provider
    ? await provider(identity, request, coverLetterSchema, signal)
    : await (await import("../../../core/models/cvcomet-ai-sdk")).cvcometAgentModel.object(
      identity, request, coverLetterSchema, signal,
    );
  return coverLetterSchema.parse(response).coverLetter;
}
