import type { ApprovalChallenge } from "../policies/approval.ts";
import { verifyApprovalDecision } from "../policies/approval.ts";
import type { AgentToolContext } from "./agent-tool-registry.ts";
import { AgentToolRegistry } from "./agent-tool-registry.ts";

/**
 * Keep prepare/review/execute in ONE node. LangGraph restarts an interrupted
 * node on resume; pre-interrupt operations MUST be read-only and replay-safe.
 *
 * The review callback is supplied by a trusted LangGraph node using interrupt().
 * Never accept a callback or AgentToolContext from HTTP/model parameters.
 */
export async function executeReviewedTool(options: {
  registry: AgentToolRegistry;
  name: string;
  input: unknown;
  context: AgentToolContext;
  review: (challenge: ApprovalChallenge) => unknown;
}): Promise<unknown> {
  const request = await options.registry.prepareApproval(options.name, options.input, options.context);
  // Do not catch LangGraph's special interrupt exception.
  const decision = options.review(request.challenge);
  const approval = verifyApprovalDecision(request, decision, options.context.identity);
  return options.registry.invoke(options.name, options.input, { ...options.context, approval });
}
