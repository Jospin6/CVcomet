import { CareerContractError } from "@/lib/career-os/contracts";
import { MEMORY_AGENTS } from "../tools/policy.tool";
import type { MemoryState } from "../agent/state";
export function memoryContextNode(state: typeof MemoryState.State) {
  if (!state.actorId) throw new CareerContractError(401, "UNAUTHORIZED");
  if (!MEMORY_AGENTS.includes(state.agentId)) throw new CareerContractError(403, "MEMORY_SCOPE_FORBIDDEN");
  return { verified: false };
}
