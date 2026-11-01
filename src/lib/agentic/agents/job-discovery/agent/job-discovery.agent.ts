import { randomUUID } from "node:crypto";
import { AgenticError } from "../../../core/errors.ts";
import { runAgentGraph } from "../../../core/execution/runner.ts";
import { normalizeEditorResume } from "@/lib/resume-editor";
import { matchingPreferencesSchema } from "@/lib/find-jobs/for-you";
import { JobDiscoveryState, type JobDiscoveryInput } from "./state";
import { createJobDiscoveryGraph } from "./graph";
import type { JobDiscoveryDependencies } from "../tools/contracts.tool";

/** Route must establish authenticated actor + owned CV before calling. */
export async function runJobDiscoveryAgent(options: {
  actorId: string;
  input: JobDiscoveryInput;
  signal?: AbortSignal;
  deps?: JobDiscoveryDependencies;
}) {
  if (!options.actorId?.trim()) throw new AgenticError("AGENT_INVALID_IDENTITY", 401);
  if (!options.input || !["fr", "en"].includes(options.input.language)) {
    throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400);
  }
  const preferences = matchingPreferencesSchema.safeParse(options.input.preferences);
  if (!preferences.success || !preferences.data.cvId) {
    throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400);
  }
  // A parsed, server-owned EditorResume is the sole skill evidence used here.
  const resume = normalizeEditorResume(options.input.resume as unknown as Record<string, unknown>);
  const state = await runAgentGraph<Partial<typeof JobDiscoveryState.State>, typeof JobDiscoveryState.State>({
    identity: {
      runId: randomUUID(), agentId: "job-discovery",
      access: { kind: "authenticated", actorId: options.actorId },
    },
    input: { input: { resume, preferences: preferences.data, language: options.input.language } },
    createGraph: scope => createJobDiscoveryGraph(scope, options.deps),
    signal: options.signal,
    timeoutMs: 55_000,
    recursionLimit: 16,
  });
  if (!state.result) throw new AgenticError("AGENT_RUN_FAILED", 502);
  return state.result;
}
