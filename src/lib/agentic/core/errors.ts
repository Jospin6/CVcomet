export type AgenticErrorCode =
  | "AGENT_INVALID_IDENTITY"
  | "AGENT_ACCESS_DENIED"
  | "AGENT_CANCELLED"
  | "AGENT_DEADLINE_EXCEEDED"
  | "AGENT_STEP_FAILED"
  | "AGENT_RUN_FAILED"
  | "AGENT_TOOL_UNKNOWN"
  | "AGENT_TOOL_DUPLICATE"
  | "AGENT_TOOL_INPUT_INVALID"
  | "AGENT_TOOL_FORBIDDEN"
  | "AGENT_INVALID_BUDGET"
  | "AGENT_INVALID_MISSION_ID"
  | "AGENT_CHECKPOINT_NOT_CONFIGURED"
  | "AGENT_CHECKPOINT_CONFIG_INVALID"
  | "AGENT_CHECKPOINT_UNAVAILABLE"
  | "AGENT_CHECKPOINT_BUSY"
  | "AGENT_THREAD_ALREADY_EXISTS"
  | "AGENT_THREAD_NOT_FOUND"
  | "AGENT_THREAD_NOT_INTERRUPTED"
  | "AGENT_THREAD_NOT_RETRYABLE"
  | "AGENT_THREAD_BUSY"
  | "AGENT_APPROVAL_REQUIRED"
  | "AGENT_APPROVAL_INVALID"
  | "AGENT_APPROVAL_REJECTED"
  | "AGENT_MODEL_INPUT_INVALID"
  | "AGENT_MODEL_UNAVAILABLE"
  | "AGENT_MODEL_QUOTA_DENIED"
  | "AGENT_CONTEXT_INVALID"
  | "AGENT_CONTEXT_FORBIDDEN"
  | "AGENT_CONTEXT_NOT_FOUND"
  | "AGENT_CONTEXT_INCONSISTENT"
  | "AGENT_CONTEXT_LIMIT_EXCEEDED"
  | "AGENT_CONTEXT_UNAVAILABLE";

/** Safe machine-readable errors; never forward provider or DB error messages. */
export class AgenticError extends Error {
  readonly code: AgenticErrorCode;
  readonly status: number;

  constructor(code: AgenticErrorCode, status = 500) {
    super(code);
    this.name = "AgenticError";
    this.code = code;
    this.status = status;
  }
}

export function normalizeAgenticError(error: unknown): AgenticError {
  return error instanceof AgenticError
    ? error
    : new AgenticError("AGENT_RUN_FAILED");
}
