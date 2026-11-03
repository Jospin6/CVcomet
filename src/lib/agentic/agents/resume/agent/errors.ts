import { ProfileError, profileAIError } from "@/lib/career-profile/http";
import { AgenticError } from "../../../core/errors.ts";

/** Translate provider failures BEFORE LangGraph reduces unknown errors to AGENT_RUN_FAILED.
 * Safe diagnostic codes only: never return provider text, CV data or prompt content. */
export function resumeProviderAgentError(error: unknown): AgenticError {
  if (error instanceof AgenticError) return error;
  const safe = error instanceof ProfileError ? error : profileAIError(error);
  switch (safe.code) {
    case "AI_LIMIT":
    case "AI_HOURLY_LIMIT":
    case "AI_MONTHLY_LIMIT":
      return new AgenticError("AGENT_MODEL_QUOTA_DENIED", 429);
    case "AI_RATE_LIMIT":
      return new AgenticError("AGENT_MODEL_RATE_LIMITED", 429);
    case "AI_AUTH_ERROR":
      return new AgenticError("AGENT_MODEL_AUTH_FAILED", 503);
    case "AI_MODEL_UNAVAILABLE":
      return new AgenticError("AGENT_MODEL_NOT_FOUND", 503);
    case "AI_TIMEOUT":
      return new AgenticError("AGENT_DEADLINE_EXCEEDED", 504);
    case "AI_CONTEXT_TOO_LARGE":
      return new AgenticError("AGENT_CONTEXT_LIMIT_EXCEEDED", 413);
    case "AI_INVALID_RESPONSE":
    case "AI_INVALID_EDIT":
      return new AgenticError("AGENT_MODEL_INVALID_RESPONSE", 502);
    case "AI_UNAVAILABLE":
    case "AI_PROVIDER_UNAVAILABLE":
      return new AgenticError("AGENT_MODEL_UNAVAILABLE", 503);
    default:
      return new AgenticError("AGENT_MODEL_FAILED", 502);
  }
}

/** Existing safe HTTP contract; each known failure is kept separate. */
export function resumeAgentApiError(error: unknown): unknown {
  if (!(error instanceof AgenticError)) return error;
  switch (error.code) {
    case "AGENT_MODEL_QUOTA_DENIED":
      return new ProfileError(429, "AI_LIMIT");
    case "AGENT_MODEL_RATE_LIMITED":
      return new ProfileError(429, "AI_RATE_LIMIT");
    case "AGENT_MODEL_AUTH_FAILED":
      return new ProfileError(503, "AI_AUTH_ERROR");
    case "AGENT_MODEL_NOT_FOUND":
      return new ProfileError(503, "AI_MODEL_UNAVAILABLE");
    case "AGENT_MODEL_INVALID_RESPONSE":
      return new ProfileError(502, "AI_INVALID_RESPONSE");
    case "AGENT_MODEL_FAILED":
      return new ProfileError(502, "AI_FAILED");
    case "AGENT_CANCELLED":
      return new ProfileError(499, "AI_CANCELLED");
    case "AGENT_DEADLINE_EXCEEDED":
      return new ProfileError(504, "AI_TIMEOUT");
    case "AGENT_MODEL_UNAVAILABLE":
      return new ProfileError(503, "AI_PROVIDER_UNAVAILABLE");
    case "AGENT_CONTEXT_LIMIT_EXCEEDED":
      return new ProfileError(413, "AI_CONTEXT_TOO_LARGE");
    case "AGENT_MODEL_INPUT_INVALID":
      return new ProfileError(error.status >= 400 && error.status < 500 ? error.status : 400, "VALIDATION");
    case "AGENT_RUN_FAILED":
    case "AGENT_STEP_FAILED":
      return new ProfileError(502, "AI_AGENT_ERROR");
    case "AGENT_ACCESS_DENIED":
      return new ProfileError(403, "FORBIDDEN");
    default:
      return new ProfileError(502, "AI_FAILED");
  }
}
