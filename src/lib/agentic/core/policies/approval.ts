import { createHash } from "node:crypto";
import type { AgentRunIdentity } from "../contracts.ts";
import { AgenticError } from "../errors.ts";
import { assertRunIdentity } from "./identity.ts";

const TOOL_NAME = /^[a-z][a-z0-9_]{1,63}$/;
const SAFE_REF = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResourceRevision = Readonly<{ resourceId: string; revision: string }>;

/** Never put document text, candidate facts or raw tool arguments in an interrupt. */
export type ApprovalChallenge = Readonly<{
  kind: "agent.tool.approval";
  approvalId: string;
  toolName: string;
  resourceId: string;
  revision: string;
}>;

export type ApprovalRequest = Readonly<{
  challenge: ApprovalChallenge;
  binding: Readonly<{
    actorId: string;
    agentId: string;
    missionId: string;
    argumentsDigest: string;
  }>;
}>;

/** In-process capability. Never serialized to LangGraph state, tool input or a browser. */
export type VerifiedApproval = Readonly<{
  approvalId: string;
  actorId: string;
  agentId: string;
  missionId: string;
  toolName: string;
  resourceId: string;
  revision: string;
  argumentsDigest: string;
  idempotencyKey: string;
}>;

const issuedRequests = new WeakSet<object>();
const issuedApprovals = new WeakSet<object>();

function safeCanonical(value: unknown, depth = 0, ancestors = new Set<object>()): string {
  if (depth > 24) throw new AgenticError("AGENT_APPROVAL_INVALID", 400);
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new AgenticError("AGENT_APPROVAL_INVALID", 400);
    ancestors.add(value);
    try { return `[${value.map((item) => safeCanonical(item, depth + 1, ancestors)).join(",")}]`; }
    finally { ancestors.delete(value); }
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Object.getPrototypeOf(record) !== Object.prototype && Object.getPrototypeOf(record) !== null) {
      throw new AgenticError("AGENT_APPROVAL_INVALID", 400);
    }
    if (ancestors.has(record)) throw new AgenticError("AGENT_APPROVAL_INVALID", 400);
    ancestors.add(record);
    try {
      return `{${Object.keys(record).sort().map((key) => {
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
          throw new AgenticError("AGENT_APPROVAL_INVALID", 400);
        }
        return `${JSON.stringify(key)}:${safeCanonical(record[key], depth + 1, ancestors)}`;
      }).join(",")}}`;
    } finally { ancestors.delete(record); }
  }
  throw new AgenticError("AGENT_APPROVAL_INVALID", 400);
}

export function digestToolArguments(input: unknown): string {
  const json = safeCanonical(input);
  if (json.length > 256_000) throw new AgenticError("AGENT_APPROVAL_INVALID", 400);
  return createHash("sha256").update(json).digest("hex");
}

export function makeApprovalRequest(options: {
  identity: AgentRunIdentity;
  missionId: string;
  toolName: string;
  target: ResourceRevision;
  input: unknown;
}): ApprovalRequest {
  assertRunIdentity(options.identity);
  if (options.identity.access.kind !== "authenticated") throw new AgenticError("AGENT_ACCESS_DENIED", 403);
  if (!UUID.test(options.missionId) || !TOOL_NAME.test(options.toolName) ||
      !SAFE_REF.test(options.target.resourceId) || !SAFE_REF.test(options.target.revision)) {
    throw new AgenticError("AGENT_APPROVAL_INVALID", 400);
  }
  const binding = {
    actorId: options.identity.access.actorId,
    agentId: options.identity.agentId,
    missionId: options.missionId.toLowerCase(),
    argumentsDigest: digestToolArguments(options.input),
  };
  // Deterministic across node replays (interrupt restarts its node on resume).
  const approvalId = createHash("sha256").update(JSON.stringify({
    ...binding, toolName: options.toolName, target: options.target,
  })).digest("hex");
  const request: ApprovalRequest = Object.freeze({
    challenge: Object.freeze({ kind: "agent.tool.approval", approvalId, toolName: options.toolName,
      resourceId: options.target.resourceId, revision: options.target.revision }),
    binding: Object.freeze(binding),
  });
  issuedRequests.add(request);
  return request;
}

export function verifyApprovalDecision(
  request: ApprovalRequest,
  raw: unknown,
  identity: AgentRunIdentity,
): VerifiedApproval {
  assertRunIdentity(identity);
  if (!issuedRequests.has(request)) throw new AgenticError("AGENT_APPROVAL_INVALID", 400);
  if (identity.access.kind !== "authenticated" ||
      identity.access.actorId !== request.binding.actorId ||
      identity.agentId !== request.binding.agentId) {
    throw new AgenticError("AGENT_ACCESS_DENIED", 403);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AgenticError("AGENT_APPROVAL_INVALID", 400);
  }
  const response = raw as Record<string, unknown>;
  if (Object.keys(response).sort().join(",") !== "approvalId,decision" ||
      response.approvalId !== request.challenge.approvalId ||
      (response.decision !== "approve" && response.decision !== "reject")) {
    throw new AgenticError("AGENT_APPROVAL_INVALID", 400);
  }
  if (response.decision === "reject") throw new AgenticError("AGENT_APPROVAL_REJECTED", 409);
  const receipt: VerifiedApproval = Object.freeze({
    approvalId: request.challenge.approvalId,
    ...request.binding,
    toolName: request.challenge.toolName,
    resourceId: request.challenge.resourceId,
    revision: request.challenge.revision,
    idempotencyKey: `agentic-${request.challenge.approvalId}`,
  });
  issuedApprovals.add(receipt);
  return receipt;
}

export function assertVerifiedApproval(options: {
  receipt: VerifiedApproval | undefined;
  request: ApprovalRequest;
}): VerifiedApproval {
  const { receipt, request } = options;
  if (!issuedRequests.has(request) || !receipt || !issuedApprovals.has(receipt) ||
      receipt.approvalId !== request.challenge.approvalId ||
      receipt.actorId !== request.binding.actorId ||
      receipt.agentId !== request.binding.agentId ||
      receipt.missionId !== request.binding.missionId ||
      receipt.toolName !== request.challenge.toolName ||
      receipt.resourceId !== request.challenge.resourceId ||
      receipt.revision !== request.challenge.revision ||
      receipt.argumentsDigest !== request.binding.argumentsDigest) {
    throw new AgenticError("AGENT_APPROVAL_REQUIRED", 403);
  }
  return receipt;
}
