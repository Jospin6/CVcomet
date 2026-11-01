import { AgenticError } from "../../core/errors.ts";
import { assertRunIdentity } from "../../core/policies/identity.ts";
import type { CareerContextKind, CareerContextRequest } from "./contracts.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** No wildcard or implicit cross-agent privileges. Supervisor only gets explicitly requested sources. */
export const CAREER_CONTEXT_SCOPES: Readonly<Record<string, readonly CareerContextKind[]>> = {
  profile: ["profile"],
  resume: ["profile", "resume"],
  "cover-letter": ["profile", "resume", "job", "cover-letter"],
  ats: ["resume", "job"],
  "job-match": ["resume", "job"],
  "job-discovery": ["profile", "resume"],
  "career-map": ["profile"],
  "interview-text": ["resume", "job", "application"],
  "interview-voice": ["resume", "job", "application"],
  application: ["profile", "resume", "job", "application", "cover-letter"],
  supervisor: ["profile", "resume", "job", "application", "cover-letter"],
};

const selectorTypes = {
  profile: "profile",
  resumeId: "resume",
  jobId: "job",
  applicationId: "application",
  coverLetterId: "cover-letter",
} as const;

export type ParsedContextSelectors = Readonly<{
  actorId: string;
  selected: readonly CareerContextKind[];
  profile?: true;
  resumeId?: string;
  jobId?: string;
  applicationId?: string;
  coverLetterId?: string;
}>;

export function parseContextRequest(request: CareerContextRequest): ParsedContextSelectors {
  assertRunIdentity(request?.identity);
  const { identity, selectors } = request;
  if (identity.access.kind !== "authenticated") throw new AgenticError("AGENT_ACCESS_DENIED", 403);
  if (!selectors || typeof selectors !== "object" || Array.isArray(selectors)) {
    throw new AgenticError("AGENT_CONTEXT_INVALID", 400);
  }
  const names = Object.keys(selectors);
  if (!names.length || names.some((key) => !(key in selectorTypes))) {
    throw new AgenticError("AGENT_CONTEXT_INVALID", 400);
  }
  const selected: CareerContextKind[] = [];
  for (const name of names) {
    const key = name as keyof typeof selectorTypes;
    const value = selectors[key];
    if (key === "profile" ? value !== true : typeof value !== "string" || !UUID.test(value)) {
      throw new AgenticError("AGENT_CONTEXT_INVALID", 400);
    }
    selected.push(selectorTypes[key]);
  }
  const permitted = CAREER_CONTEXT_SCOPES[identity.agentId];
  if (!permitted || selected.some((scope) => !permitted.includes(scope))) {
    throw new AgenticError("AGENT_CONTEXT_FORBIDDEN", 403);
  }
  return { actorId: identity.access.actorId, selected, ...selectors };
}
