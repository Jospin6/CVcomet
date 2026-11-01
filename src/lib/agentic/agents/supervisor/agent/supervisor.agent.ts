import { randomUUID } from "node:crypto";
import type { AgentEventListener } from "../../../core/contracts.ts";
import { runAgentGraph } from "../../../core/execution/runner.ts";
import { AgenticError } from "../../../core/errors.ts";
import { CareerContractError } from "@/lib/career-os/contracts";
import { SupervisorState } from "./state";
import { createSupervisorGraph } from "./graph";
import { assertSupervisorInput } from "../tools/routing.tool";
import type { SupervisorInput, SupervisorDependencies } from "../tools/contracts.tool";

export async function runCareerSupervisorAgent(options: {
  input: SupervisorInput; deps: SupervisorDependencies; signal?: AbortSignal;
  onEvent?: AgentEventListener;
}) {
  assertSupervisorInput(options.input);
  // Runner deliberately redacts unexpected errors. Preserve only previously
  // vetted owner/permission errors and known quota codes from trusted services.
  let protectedFailure: CareerContractError | null = null;
  const protect = <TArgs extends unknown[], T>(callback: (...args: TArgs) => Promise<T>) =>
    async (...args: TArgs): Promise<T> => {
      try { return await callback(...args); }
      catch (error) {
        if (error instanceof CareerContractError) protectedFailure = error;
        else if (error && typeof error === "object" && "code" in error &&
          ["AI_LIMIT", "AI_HOURLY_LIMIT", "AI_MONTHLY_LIMIT"].includes(String(error.code))) {
          protectedFailure = new CareerContractError(429, String(error.code));
        }
        throw error;
      }
    };
  const dependencies: SupervisorDependencies = {
    selectPlan: protect(options.deps.selectPlan),
    readSelected: protect(options.deps.readSelected),
    respond: protect(options.deps.respond),
    ...(options.deps.delegateSpecialist ? { delegateSpecialist: protect(options.deps.delegateSpecialist) } : {}),
  };
  try {
    const state = await runAgentGraph<Partial<typeof SupervisorState.State>, typeof SupervisorState.State>({
      identity: { runId: randomUUID(), agentId: "supervisor",
        access: { kind: "authenticated", actorId: options.input.actorId } },
      input: { input: options.input },
      createGraph: scope => createSupervisorGraph(scope, dependencies),
      timeoutMs: 55_000, recursionLimit: 16, signal: options.signal, onEvent: options.onEvent,
    });
    if (!state.verified || !state.result) throw new CareerContractError(502, "AGENT_FAILED");
    return state.result;
  } catch (error) {
    if (protectedFailure) throw protectedFailure;
    // Existing APIs use CareerContractError, not arbitrary vendor/Graph errors.
    if (error instanceof CareerContractError) throw error;
    if (error instanceof AgenticError && ["AGENT_CANCELLED", "AGENT_DEADLINE_EXCEEDED"].includes(error.code)) {
      throw new CareerContractError(504, "AGENT_TIME_BUDGET_EXCEEDED");
    }
    throw new CareerContractError(502, "AGENT_FAILED");
  }
}
