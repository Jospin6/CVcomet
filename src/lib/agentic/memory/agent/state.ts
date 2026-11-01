import { Annotation } from "@langchain/langgraph";
import type { MemoryAgent } from "../tools/policy.tool";
import type { AgentMemorySnapshot } from "../tools/assemble.tool";

/** Ephemeral graph state. Never attach a checkpointer to private memory data. */
export const MemoryState = Annotation.Root({
  actorId: Annotation<string>,
  agentId: Annotation<MemoryAgent>,
  missionId: Annotation<string | undefined>,
  snapshot: Annotation<AgentMemorySnapshot>,
  verified: Annotation<boolean>,
});
