import { randomUUID } from "node:crypto";
import { coverLetterContentSchema, coverLetterDesignSchema } from "@/lib/cover-letter-editor";
import { runAgentGraph } from "../../../core/execution/runner.ts";
import type { AgentRunIdentity } from "../../../core/contracts.ts";
import { AgenticError } from "../../../core/errors.ts";
import { createLetterEditGraph } from "./graph";
import { LetterEditState, type LetterEditInput } from "./state";
import type { LetterEditModel } from "../tools/generate-edit.tool";
import { letterAgentApiError } from "./errors";

/** One trusted entry point for editor Chat, Selected text and Application Agent. */
export async function runCoverLetterEditAgent(options: {
  actorId: string;
  input: LetterEditInput;
  signal?: AbortSignal;
  model?: LetterEditModel;
}) {
  const input = options.input;
  if (typeof options.actorId !== "string" || !options.actorId.trim()) {
    throw new AgenticError("AGENT_INVALID_IDENTITY", 401);
  }
  if (!input || typeof input.instruction !== "string" || !input.instruction.trim() ||
    input.instruction.length > 4_000 || !["fr", "en"].includes(input.language) ||
    (input.targetField && !["introduction", "body", "conclusion"].includes(input.targetField)) ||
    (input.history?.length ?? 0) > 8 ||
    input.history?.some(h => !["user", "assistant"].includes(h.role) || typeof h.content !== "string" || h.content.length > 4000) ||
    !Array.isArray(input.profileFacts) || input.profileFacts.length > 50 ||
    !Array.isArray(input.requirements) || input.requirements.length > 200) {
    throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400);
  }
  const document = coverLetterContentSchema.extend({ design: coverLetterDesignSchema }).parse(input.document);
  const identity: AgentRunIdentity = { runId: randomUUID(), agentId: "cover-letter",
    access: { kind: "authenticated", actorId: options.actorId } };
  let state: typeof LetterEditState.State;
  try {
    state = await runAgentGraph<Partial<typeof LetterEditState.State>, typeof LetterEditState.State>({
      identity, input: { input: { ...input, document } },
      createGraph: scope => createLetterEditGraph(scope, options.model),
      signal: options.signal, timeoutMs: 55_000, recursionLimit: 12,
    });
  } catch (error) { throw letterAgentApiError(error); }
  if (!state.result || (state.result.status === "proposal" && (!state.readyForReview || !state.result.document))) {
    throw new AgenticError("AGENT_RUN_FAILED", 502);
  }
  return state.result;
}
