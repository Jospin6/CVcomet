import { randomUUID } from "node:crypto";
import type { AgentRunIdentity } from "../../../core/contracts.ts";
import { AgenticError } from "../../../core/errors.ts";
import { runAgentGraph } from "../../../core/execution/runner.ts";
import { createLetterCreationGraph } from "./creation-graph";
import { LetterCreationState, type LetterCreationInput } from "./creation-state";
import type { LetterCreationModel } from "../tools/generate-creation.tool";
import { letterAgentApiError } from "./errors";
import { ProfileError } from "@/lib/career-profile/http";

/** Generates a *draft*, never a saved cover letter; the caller owns SAVE + authorization. */
export async function runCoverLetterCreationAgent(options: {
  actorId: string;
  input: LetterCreationInput;
  signal?: AbortSignal;
  model?: LetterCreationModel;
}) {
  const input = options.input;
  if (typeof options.actorId !== "string" || !options.actorId.trim()) {
    throw new AgenticError("AGENT_INVALID_IDENTITY", 401);
  }
  if (!input || typeof input.facts !== "string" || input.facts.length > 32_000 ||
    typeof input.notes !== "string" || input.notes.length > 4_000 ||
    !["fr", "en", "de"].includes(input.documentLanguage) ||
    !Array.isArray(input.technicalRequirements) || input.technicalRequirements.length > 200) {
    throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400);
  }
  const identity: AgentRunIdentity = { runId: randomUUID(), agentId: "cover-letter",
    access: { kind: "authenticated", actorId: options.actorId } };
  let state: typeof LetterCreationState.State;
  try {
    state = await runAgentGraph<Partial<typeof LetterCreationState.State>, typeof LetterCreationState.State>({
      identity, input: { input },
      createGraph: scope => createLetterCreationGraph(scope, options.model),
      signal: options.signal, timeoutMs: 55_000, recursionLimit: 12,
    });
  } catch (error) { throw letterAgentApiError(error); }
  if (!state.plan?.ready) throw new ProfileError(422, state.plan?.reason || "AI_FACTS_REQUIRED");
  if (state.issue) throw new ProfileError(422, state.issue);
  if (!state.readyForReview || !state.verified) throw new AgenticError("AGENT_RUN_FAILED", 502);
  return state.verified;
}
