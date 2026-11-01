import { randomUUID } from "node:crypto";
import { resumeAgentApiError } from "./errors";
import { AgenticError } from "../../../core/errors.ts";
import type { AgentRunIdentity } from "../../../core/contracts.ts";
import { runAgentGraph } from "../../../core/execution/runner.ts";
import { createResumeFieldGraph } from "./field-graph";
import { ResumeFieldState, type ResumeFieldInput } from "./field-state";
import type { FieldModel } from "../tools/field-generation.tool";

/** Generates a field proposal. Does not persist or apply anything to a CV. */
export async function runResumeFieldAgent(options: {
  actorId: string;
  input: ResumeFieldInput;
  signal?: AbortSignal;
  model?: FieldModel;
}) {
  const identity: AgentRunIdentity = { runId: randomUUID(), agentId: "resume",
    access: { kind: "authenticated", actorId: options.actorId } };
  let result: typeof ResumeFieldState.State;
  try {
    result = await runAgentGraph<Partial<typeof ResumeFieldState.State>, typeof ResumeFieldState.State>({
    identity, input: { input: options.input },
    createGraph: scope => createResumeFieldGraph(scope, options.model),
    signal: options.signal, timeoutMs: 55_000, recursionLimit: 12,
    });
  } catch (error) { throw resumeAgentApiError(error); }
  if (result.issue) return { proposal: "" as const, issue: result.issue };
  if (!result.readyForReview || !result.proposal) throw new AgenticError("AGENT_RUN_FAILED", 502);
  return { proposal: result.proposal };
}
