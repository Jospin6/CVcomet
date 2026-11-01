import { randomUUID } from "node:crypto";
import type { AgentRunIdentity } from "../../../core/contracts.ts";
import { AgenticError } from "../../../core/errors.ts";
import { runAgentGraph } from "../../../core/execution/runner.ts";
import { jobTextSchema } from "@/lib/career/job-schema";
import { profileDataSchema } from "@/lib/career-profile/schema";
import { resumeContentSchema } from "@/lib/resume-editor";
import { createJobMatchGraph } from "./graph";
import { JobMatchAgentState, type JobMatchAgentInput } from "./state";
import type { JobMatchDependencies } from "../tools/extract.tool";

/** The caller must authorize ownership of CV/application *before* invoking. */
export async function runJobMatchAgent(options: {
  actorId: string;
  input: JobMatchAgentInput;
  signal?: AbortSignal;
  deps?: JobMatchDependencies;
}) {
  if (!options.actorId?.trim()) throw new AgenticError("AGENT_INVALID_IDENTITY", 401);
  if (!options.input || !["fr", "en"].includes(options.input.language) ||
      !jobTextSchema.safeParse(options.input.description).success) {
    throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400);
  }
  const input: JobMatchAgentInput = {
    ...options.input,
    profile: profileDataSchema.parse(options.input.profile),
    resume: options.input.resume ? resumeContentSchema.parse(options.input.resume) : undefined,
  };
  const identity: AgentRunIdentity = {
    runId: randomUUID(), agentId: "job-match",
    access: { kind: "authenticated", actorId: options.actorId },
  };
  const state = await runAgentGraph<Partial<typeof JobMatchAgentState.State>, typeof JobMatchAgentState.State>({
    identity,
    input: { input },
    createGraph: scope => createJobMatchGraph(scope, options.deps),
    signal: options.signal,
    timeoutMs: 55_000,
    recursionLimit: 14,
  });
  if (!state.verified || !state.result) throw new AgenticError("AGENT_RUN_FAILED", 502);
  return state.result;
}
