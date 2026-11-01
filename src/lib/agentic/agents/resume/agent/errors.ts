import { ProfileError } from "@/lib/career-profile/http";
import { AgenticError } from "../../../core/errors.ts";

/** Public API keeps existing bounded, user-safe error semantics. */
export function resumeAgentApiError(error: unknown): unknown {
  if (!(error instanceof AgenticError)) return error;
  switch (error.code) {
    case "AGENT_MODEL_QUOTA_DENIED":
      return new ProfileError(429, "AI_LIMIT");
    case "AGENT_CANCELLED":
      return new ProfileError(499, "AI_CANCELLED");
    case "AGENT_DEADLINE_EXCEEDED":
      return new ProfileError(504, "AI_TIMEOUT");
    case "AGENT_MODEL_UNAVAILABLE":
      return new ProfileError(503, "AI_PROVIDER_UNAVAILABLE");
    case "AGENT_MODEL_INPUT_INVALID":
      return new ProfileError(error.status >= 400 && error.status < 500 ? error.status : 400, "VALIDATION");
    case "AGENT_ACCESS_DENIED":
      return new ProfileError(403, "FORBIDDEN");
    default:
      return new ProfileError(502, "AI_FAILED");
  }
}
