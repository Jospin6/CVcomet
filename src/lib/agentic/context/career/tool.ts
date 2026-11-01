import type { AgentToolRegistry } from "../../core/tools/agent-tool-registry.ts";
import { createCareerContextEngine } from "./engine.ts";
import { CAREER_CONTEXT_SCOPES, parseContextRequest } from "./policy.ts";
import type { CareerContextRepository, CareerContextRequest } from "./contracts.ts";

/**
 * Stage-04 policy gateway bridge, still read-only. Agent-specific tools can
 * invoke this service in later steps; no legacy route is changed here.
 */
export function registerCareerContextReadTool(
  registry: AgentToolRegistry,
  repository: CareerContextRepository,
): void {
  const engine = createCareerContextEngine(repository);
  registry.register({
    name: "read_career_context",
    capability: "read",
    permittedAgents: Object.keys(CAREER_CONTEXT_SCOPES),
    parse(raw: unknown): CareerContextRequest["selectors"] {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("INVALID_SELECTOR");
      return raw as CareerContextRequest["selectors"];
    },
    authorize(selectors, context) {
      // Trusted user identity is always taken from AgentToolContext.
      parseContextRequest({ identity: context.identity, selectors });
    },
    execute(selectors, context) {
      return engine.load({ identity: context.identity, selectors, signal: context.signal });
    },
  });
}
