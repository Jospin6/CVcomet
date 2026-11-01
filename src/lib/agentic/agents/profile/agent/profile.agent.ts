import { randomUUID } from "node:crypto";
import { runAgentGraph } from "../../../core/execution/runner.ts";
import type { AgentRunIdentity } from "../../../core/contracts.ts";
import { AgenticError } from "../../../core/errors.ts";
import { createProfileAgentGraph, type ProfileAgentDependencies } from "./graph";
import type { ProfileAgentState } from "./state";

/** The only API of the Profile Agent. An import produces a reviewable draft,
 * never a persisted profile; account ownership always comes from the session. */
export async function runProfileImportAgent(options: {
  actorId: string;
  deps: ProfileAgentDependencies;
  signal?: AbortSignal;
}) {
  const identity: AgentRunIdentity = {
    runId: randomUUID(),
    agentId: "profile",
    access: { kind: "authenticated", actorId: options.actorId },
  };
  const result = await runAgentGraph<Partial<typeof ProfileAgentState.State>, typeof ProfileAgentState.State>({
    identity, input: {},
    createGraph: scope => createProfileAgentGraph(scope, options.deps),
    timeoutMs: 55_000,
    recursionLimit: 12,
    signal: options.signal,
  });
  if (!result.readyForReview || !result.current || !result.extracted || !result.review || !result.proposal) {
    throw new AgenticError("AGENT_RUN_FAILED", 500);
  }
  // Do not expose current profile or graph state to clients.
  return {
    extracted: result.extracted,
    proposal: result.proposal,
    review: { ...result.review, unverifiedFields: result.unverifiedFields || [],
      evidenceMode: result.evidenceMode || "native_pdf_review" },
    baseRevision: result.current.revision,
    requiresConfirmation: true as const,
  };
}
