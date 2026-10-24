/**
 * CVComet Career OS public contract, v1.
 * Keep this module independent of Prisma, Next.js and AI providers so clients,
 * workers, and policy tests can depend on the same versioned declarations.
 */
export const CAREER_API_VERSION = "v1" as const;

export const CAREER_READ_TOOLS = [
  "get_my_profile",
  "list_my_resumes",
  "get_my_resume",
  "list_my_applications",
  "list_my_confirmed_evidence",
  "get_my_job_match_insights",
  "list_my_application_packets",
] as const;

export type CareerReadTool = (typeof CAREER_READ_TOOLS)[number];
export type CareerEffect = "read" | "draft" | "external" | "sensitive_write";

export type CareerToolDescriptor = Readonly<{
  id: string;
  effect: CareerEffect;
  available: boolean;
  description: string;
  requiresApproval: boolean;
}>;

/** Informational catalog: planned tools are not runnable. */
export const CAREER_TOOL_CATALOG: readonly CareerToolDescriptor[] = [
  { id: "get_my_profile", effect: "read", available: true, description: "Read my professional profile (self-reported, NOT verified evidence)", requiresApproval: false },
  { id: "list_my_resumes", effect: "read", available: true, description: "List my resume summaries", requiresApproval: false },
  { id: "get_my_resume", effect: "read", available: true, description: "Read a resume owned by my account", requiresApproval: false },
  { id: "list_my_applications", effect: "read", available: true, description: "List my application summaries", requiresApproval: false },
  { id: "list_my_confirmed_evidence", effect: "read", available: true, description: "Read only facts explicitly confirmed by their owner (not independently verified)", requiresApproval: false },
  { id: "get_my_job_match_insights", effect: "read", available: true, description: "Summarize one of my saved job comparisons, with evidence gaps and action suggestions; not a hiring probability", requiresApproval: false },
  { id: "list_my_application_packets", effect: "read", available: true, description: "List my saved application packets; READY means reviewed, not submitted or emailed", requiresApproval: false },
  { id: "analyze_job", effect: "draft", available: false, description: "Analyze a job offer without saving it", requiresApproval: false },
  { id: "draft_resume_changes", effect: "draft", available: false, description: "Prepare resume edits for review", requiresApproval: false },
  { id: "draft_cover_letter", effect: "draft", available: false, description: "Prepare a cover letter draft", requiresApproval: false },
  { id: "submit_application", effect: "external", available: false, description: "Submit a job application", requiresApproval: true },
  { id: "send_application_email", effect: "external", available: false, description: "Email an employer", requiresApproval: true },
] as const;

export function isCareerReadTool(value: string): value is CareerReadTool {
  return (CAREER_READ_TOOLS as readonly string[]).includes(value);
}

export class CareerContractError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
    this.name = "CareerContractError";
  }
}

/** Never propagate caller-selected versions to the implementation silently. */
export function requireCareerVersion(version: unknown): typeof CAREER_API_VERSION {
  if (version !== CAREER_API_VERSION) throw new CareerContractError(400, "UNSUPPORTED_API_VERSION");
  return CAREER_API_VERSION;
}

export type CareerEnvelope<T> = Readonly<{
  apiVersion: typeof CAREER_API_VERSION;
  requestId: string;
  data: T;
}>;

export function careerEnvelope<T>(requestId: string, data: T): CareerEnvelope<T> {
  return { apiVersion: CAREER_API_VERSION, requestId, data };
}
