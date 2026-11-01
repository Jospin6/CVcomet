import type { AgentRunIdentity } from "../../core/contracts.ts";

export type CareerContextKind = "profile" | "resume" | "job" | "application" | "cover-letter";

/** Actor comes from the authenticated server session; never accept userId in selectors. */
export type CareerContextRequest = Readonly<{
  identity: AgentRunIdentity;
  selectors: Readonly<{
    profile?: true;
    resumeId?: string;
    jobId?: string;
    applicationId?: string;
    coverLetterId?: string;
  }>;
  signal?: AbortSignal;
}>;

/** The adapter must scope EVERY query by ownerId (including nested relations). */
export type CareerContextRepository = Readonly<{
  getProfile: (ownerId: string) => Promise<unknown | null>;
  getResume: (ownerId: string, id: string) => Promise<unknown | null>;
  getJob: (ownerId: string, id: string) => Promise<unknown | null>;
  getApplication: (ownerId: string, id: string) => Promise<unknown | null>;
  getCoverLetter: (ownerId: string, id: string) => Promise<unknown | null>;
}>;

export type CareerContextSnapshot = Readonly<{
  /** Not an LLM input: resource IDs and revisions are reserved for server-side controls. */
  references: Readonly<Partial<Record<CareerContextKind, Readonly<{ id: string; revision?: number }>>>>;
  /** Transient, allowlisted facts only. Does not contain email, phone, address, tokens or billing. */
  facts: Readonly<Partial<Record<CareerContextKind, unknown>>>;
  /** JSON data payload; must never be stored in LangGraph state/checkpoints or telemetry. */
  modelContext: string;
}>;
