import { Annotation } from "@langchain/langgraph";
import type { AgentRead, AgentStep } from "@/lib/career-os/agent-engine";
import type { SupervisorInput, SupervisorPlan, SupervisorOutput } from "../tools/contracts.tool";

/** Ephemeral only. Private career documents MUST NOT enter a supervisor checkpoint. */
export const SupervisorState = Annotation.Root({
  input: Annotation<SupervisorInput>,
  plan: Annotation<SupervisorPlan>,
  reads: Annotation<AgentRead[]>,
  steps: Annotation<AgentStep[]>,
  specialistResult: Annotation<unknown | null>,
  answer: Annotation<string>,
  verified: Annotation<boolean>,
  result: Annotation<SupervisorOutput>,
});
