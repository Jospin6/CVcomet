import type { MemoryAgent } from "../tools/policy.tool";
import type { AgentMemorySnapshot } from "../tools/assemble.tool";
import { randomUUID } from "node:crypto";
import { runAgentGraph } from "../../core/execution/runner";
import { createCareerMemoryGraph } from "./graph";
import { MemoryState } from "./state";
import { loadCareerMemoryForAgent } from "../nodes/read.node";
import { CareerContractError } from "@/lib/career-os/contracts";

/** Stage-17 read-only LangGraph, no checkpoint or writes. */
export async function runCareerMemoryAgent(options: {
  actorId: string; agentId: MemoryAgent; missionId?: string; signal?: AbortSignal;
  load?: typeof loadCareerMemoryForAgent;
}): Promise<AgentMemorySnapshot> {
  if (!options.actorId) throw new CareerContractError(401, "UNAUTHORIZED");
  let protectedError: CareerContractError | null = null;
  const loader = async (actorId: string, agentId: MemoryAgent, missionId?: string) => {
    try { return await (options.load ?? loadCareerMemoryForAgent)(actorId, agentId, missionId); }
    catch (error) { if (error instanceof CareerContractError) protectedError = error; throw error; }
  };
  try {
    const state = await runAgentGraph<Partial<typeof MemoryState.State>, typeof MemoryState.State>({
      identity: { runId: randomUUID(), agentId: "memory", access: { kind: "authenticated", actorId: options.actorId } },
      input: { actorId: options.actorId, agentId: options.agentId, missionId: options.missionId },
      createGraph: scope => createCareerMemoryGraph(scope, loader),
      timeoutMs: 8_000, recursionLimit: 8, signal: options.signal,
    });
    if (!state.verified || !state.snapshot) throw Error("MEMORY_CONTEXT_INVALID");
    return state.snapshot;
  } catch (error) {
    if (protectedError) throw protectedError;
    throw error;
  }
}
