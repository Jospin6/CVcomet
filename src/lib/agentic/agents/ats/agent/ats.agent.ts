import { randomUUID } from "node:crypto";
import type { AgentRunIdentity } from "../../../core/contracts.ts";
import { AgenticError } from "../../../core/errors.ts";
import { runAgentGraph } from "../../../core/execution/runner.ts";
import { resumeContentSchema } from "@/lib/resume-editor";
import type { AtsAgentDependencies } from "../tools/analysis.tool";
import { createAtsAgentGraph } from "./graph";
import { AtsAgentState, type AtsAgentInput } from "./state";

/** Called only after the API has checked CV and saved-job ownership.
 * Generates an analysis; the existing API owns caching and persistence. */
export async function runAtsAgent(options: {
  actorId: string;
  input: AtsAgentInput;
  signal?: AbortSignal;
  deps?: AtsAgentDependencies;
}) {
  if (!options.actorId?.trim()) throw new AgenticError("AGENT_INVALID_IDENTITY", 401);
  if (!options.input ||
    (options.input.keywords?.length ?? 0) > 60 ||
    options.input.keywords?.some(term => typeof term !== "string" || term.length > 100) ||
    (options.input.jobDescription?.length ?? 0) > 50_000 ||
    (options.input.language !== undefined && !["fr", "en"].includes(options.input.language))) {
    throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400);
  }
  const input: AtsAgentInput = {
    ...options.input,
    resume: resumeContentSchema.parse(options.input.resume),
    language: options.input.language ?? "en",
  };
  const identity: AgentRunIdentity = {
    runId: randomUUID(), agentId: "ats",
    access: { kind: "authenticated", actorId: options.actorId },
  };
  const state = await runAgentGraph<Partial<typeof AtsAgentState.State>, typeof AtsAgentState.State>({
    identity,
    input: { input },
    createGraph: scope => createAtsAgentGraph(scope, options.deps),
    signal: options.signal,
    timeoutMs: 85_000,
    recursionLimit: 14,
  });
  if (!state.verified || !state.report) throw new AgenticError("AGENT_RUN_FAILED", 502);
  return state.report;
}
