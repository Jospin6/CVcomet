import { z } from "zod";
import type { AgentRunIdentity } from "../../../core/contracts.ts";
import { AgenticError } from "../../../core/errors.ts";
import { coverLetterContentSchema, coverLetterDesignSchema } from "@/lib/cover-letter-editor";
import type { LetterEditInput, LetterEditDraft } from "../agent/state";
import { letterEditSystemPrompt, letterEditUserPrompt } from "../prompts/edit.prompt";

export const letterEditOutputSchema = z.object({
  message: z.string().min(1).max(1000),
  changes: z.array(z.string().max(500)).max(12),
  document: coverLetterContentSchema.extend({ design: coverLetterDesignSchema }),
}).strict();

export type LetterEditModel = (
  identity: AgentRunIdentity,
  request: { feature: "COVER_LETTER"; system: string; prompt: string; maxTokens: number },
  schema: typeof letterEditOutputSchema,
  signal: AbortSignal,
) => Promise<z.infer<typeof letterEditOutputSchema>>;

/** Reuses CVComet's existing model gateway and *one* COVER_LETTER quota charge. */
export async function generateLetterEdit(identity: AgentRunIdentity, input: LetterEditInput,
  signal: AbortSignal, provider?: LetterEditModel): Promise<LetterEditDraft> {
  if (identity.agentId !== "cover-letter" || identity.access.kind !== "authenticated") {
    throw new AgenticError("AGENT_ACCESS_DENIED", 403);
  }
  if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
  const model = provider ?? (await import("../../../core/models/cvcomet-ai-sdk")).cvcometAgentModel.object;
  const optInMemory = provider ? [] : (await (await import("@/lib/agentic/memory/agent/memory.agent"))
    .runCareerMemoryAgent({ actorId: identity.access.actorId, agentId: "cover_letter", signal })).preferences;
  return letterEditOutputSchema.parse(await model(identity, {
    feature: "COVER_LETTER", system: letterEditSystemPrompt(input),
    prompt: letterEditUserPrompt(input, optInMemory), maxTokens: 4500,
  }, letterEditOutputSchema, signal));
}
