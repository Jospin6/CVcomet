import { randomUUID } from "node:crypto";
import { resumeAgentApiError } from "./errors";
import { resumeContentSchema } from "@/lib/resume-editor";
import { AgenticError } from "../../../core/errors.ts";
import { runAgentGraph } from "../../../core/execution/runner.ts";
import type { AgentRunIdentity } from "../../../core/contracts.ts";
import { createResumeAgentGraph } from "./graph";
import { ResumeAgentState, type ResumeAgentInput } from "./state";
import type { ResumeAgentDependencies } from "../tools/generate-edit.tool";

/** Shared agent for editor Chat, Selected text and application resume drafts.
 * No side effects on the CV: caller must persist a review proposal and obtain
 * explicit approval using decideResumeAI. */
export async function runResumeAgent(options: {
  actorId: string;
  input: ResumeAgentInput;
  deps?: ResumeAgentDependencies;
  signal?: AbortSignal;
}) {
  const identity: AgentRunIdentity = {
    runId: randomUUID(), agentId: "resume",
    access: { kind: "authenticated", actorId: options.actorId },
  };
  // Validated at the HTTP boundary and again here for internal agent calls.
  if (typeof options.input.instruction !== "string" ||
      !options.input.instruction.trim() || options.input.instruction.length > 4_000 ||
      !["fr", "en"].includes(options.input.language) ||
      (options.input.history?.length ?? 0) > 8 ||
      (options.input.history?.some(row => !["user", "assistant"].includes(row.role) ||
        typeof row.content !== "string" || row.content.length > 4_000)) ||
      (options.input.targetField && options.input.targetField.length > 100)) {
    throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400);
  }
  const input = { ...options.input, document: resumeContentSchema.parse(options.input.document) };
  let result: typeof ResumeAgentState.State;
  try {
    result = await runAgentGraph<Partial<typeof ResumeAgentState.State>, typeof ResumeAgentState.State>({
    identity,
    input: { input },
    createGraph: scope => createResumeAgentGraph(scope, options.deps),
    signal: options.signal,
    timeoutMs: 55_000,
    recursionLimit: 12,
    });
  } catch (error) { throw resumeAgentApiError(error); }
  if (!result.result || !result.result.object ||
    (result.result.object.status === "applied" && (!result.readyForReview || !result.result.document))) {
    throw new AgenticError("AGENT_RUN_FAILED", 500);
  }
  return result.result;
}
