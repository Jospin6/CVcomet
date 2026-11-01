import { randomUUID } from "node:crypto";
import { AgenticError } from "../../../core/errors.ts";
import { runAgentGraph } from "../../../core/execution/runner.ts";
import { preferenceSchema } from "../tools/preferences.tool";
import { CareerMapState, type CareerMapAgentInput } from "./state";
import { createCareerMapGraph } from "./graph";

/** Called exclusively after authentication + CV ownership validation in service. */
export async function runCareerMapAgent(options: {
  actorId: string;
  input: CareerMapAgentInput;
  signal?: AbortSignal;
}) {
  if (!options.actorId?.trim()) throw new AgenticError("AGENT_INVALID_IDENTITY", 401);
  if (!options.input?.profile) throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400);
  const preferences = preferenceSchema.safeParse(options.input.preferences);
  if (!preferences.success) throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400);
  const result = await runAgentGraph<Partial<typeof CareerMapState.State>, typeof CareerMapState.State>({
    identity: { runId: randomUUID(), agentId: "career-map",
      access: { kind: "authenticated", actorId: options.actorId } },
    input: { input: { ...options.input, preferences: preferences.data } },
    createGraph: scope => createCareerMapGraph(scope),
    signal: options.signal,
    timeoutMs: 12_000,
    recursionLimit: 14,
  });
  if (!result.verified || !result.result) throw new AgenticError("AGENT_RUN_FAILED", 502);
  return result.result;
}
