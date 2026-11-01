export { AgenticError, normalizeAgenticError } from "./errors.ts";
export { runAgentGraph, type ExecutionScope } from "./execution/runner.ts";
export { runDurableAgentGraph, durableMissionExists, deleteDurableMission, type DurableStore, type CheckpointedGraph } from "./execution/durable-runner.ts";
export { makeMissionThread, type DurableMission } from "./persistence/thread.ts";
export { readCheckpointDatabaseConfig } from "./persistence/config.ts";
export { createRunBudget, type RunBudget } from "./execution/budget.ts";
export { tracedNode } from "./nodes/traced-node.ts";
export { ReadToolRegistry, type ReadToolDefinition, type ReadToolContext } from "./tools/read-tool-registry.ts";
export { assertRunIdentity } from "./policies/identity.ts";
export type { AgentAccess, AgentRunIdentity, AgentEvent, AgentEventKind, AgentEventListener } from "./contracts.ts";
export type { AgentModelPort } from "./models/model-port.ts";
// Stage 04: policy gateway, durable HITL decision binding, model quota port.
export { AgentToolRegistry, type AgentToolContext, type AgentToolDefinition } from "./tools/agent-tool-registry.ts";
export { executeReviewedTool } from "./tools/reviewed-execution.ts";
export { assertToolAccess, type ToolCapability } from "./policies/tool-access.ts";
export { makeApprovalRequest, verifyApprovalDecision, assertVerifiedApproval, type ApprovalChallenge,
  type ApprovalRequest, type VerifiedApproval, type ResourceRevision } from "./policies/approval.ts";
export { createAgentModelGateway, type ModelGatewayDependencies, type StructuredSchema } from "./models/model-gateway.ts";
export { validateModelRequest, type AgentModelRequest } from "./models/model-policy.ts";
// Provider adapter (cvcomet-ai-sdk.ts) is intentionally imported explicitly by domain nodes.
// Do not put it in the barrel: pure tests must not eagerly load Prisma/AI SDK.

// Stage 05: generic bounded context projection helpers, no Prisma dependency.
export { boundedText, boundedStrings, boundedRecords, boundedModelContext, MAX_MODEL_CONTEXT_CHARS } from "./context/limits.ts";
