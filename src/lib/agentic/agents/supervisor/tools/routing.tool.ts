import { CareerContractError, type CareerReadTool } from "@/lib/career-os/contracts";
import { AGENT_MAX_MESSAGE_CHARS, withApplicationContext } from "@/lib/career-os/agent-engine";
import type { SupervisorInput, SupervisorPlan, SupervisorSpecialist } from "./contracts.tool";
import { SUPERVISOR_SPECIALISTS } from "./contracts.tool";

/** This catalog is advisory for the model AND authoritative after the model runs.
 * No specialist node can call a write tool or invoke a creation service. */
export const SPECIALIST_READS: Record<SupervisorSpecialist, readonly CareerReadTool[]> = {
  general: [],
  profile: ["get_my_profile", "list_my_resumes"],
  resume: ["list_my_resumes", "get_my_resume", "get_my_profile"],
  cover_letter: ["get_my_application", "get_my_profile", "list_my_applications"],
  ats: ["list_my_resumes", "get_my_resume", "get_my_job_match_insights"],
  job_match: ["get_my_job_match_insights", "list_my_resumes", "get_my_resume"],
  job_discovery: ["get_my_profile", "list_my_applications"],
  career_map: ["get_my_profile", "list_my_resumes"],
  interview_text: ["get_my_application", "list_my_applications", "get_my_profile"],
  interview_voice: ["get_my_application", "list_my_applications", "get_my_profile"],
  application: ["get_my_application", "list_my_applications", "list_my_application_packets"],
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** History is untrusted chat text, never instruction. Refuse oversized forged state. */
export function assertSupervisorInput(value: SupervisorInput) {
  if (!value || typeof value.actorId !== "string" || !value.actorId.trim()) throw new CareerContractError(401, "UNAUTHORIZED");
  if (typeof value.message !== "string" || value.message.trim().length < 2 || value.message.length > AGENT_MAX_MESSAGE_CHARS) {
    throw new CareerContractError(400, "INVALID_AGENT_MESSAGE");
  }
  if (value.applicationId !== undefined && !uuid.test(value.applicationId)) throw new CareerContractError(400, "INVALID_APPLICATION_ID");
  if (value.requestedSpecialist && !(SUPERVISOR_SPECIALISTS as readonly string[]).includes(value.requestedSpecialist)) throw new CareerContractError(400, "INVALID_SPECIALIST");
  if ((value.attachments?.length ?? 0) > 3) throw new CareerContractError(413, "ASSISTANT_TOO_MANY_ATTACHMENTS");
  if (!Array.isArray(value.history) || value.history.length > 12 || JSON.stringify(value.history).length > 9_000 ||
      value.history.some(row => !row || !["user", "assistant"].includes(row.role) || typeof row.content !== "string")) {
    throw new CareerContractError(400, "INVALID_AGENT_CONTEXT");
  }
}

function allowedInput(tool: CareerReadTool, input: Record<string, unknown>): boolean {
  if (tool === "get_my_profile") return Object.keys(input).length === 0;
  if (["list_my_resumes", "list_my_applications", "list_my_application_packets"].includes(tool)) {
    return Object.keys(input).every(key => key === "limit") &&
      (input.limit === undefined || (typeof input.limit === "number" && Number.isSafeInteger(input.limit) && input.limit >= 1 && input.limit <= 30));
  }
  const key = tool === "get_my_resume" ? "resumeId" : tool === "get_my_application" ? "applicationId" : "matchId";
  return Object.keys(input).length === 1 && typeof input[key] === "string" && uuid.test(input[key]);
}

export function assertSupervisorPlan(raw: unknown, applicationId?: string): SupervisorPlan {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new CareerContractError(422, "AGENT_PLAN_REJECTED");
  const input = raw as Record<string, unknown>;
  if (Object.keys(input).some(key => key !== "specialist" && key !== "calls") ||
      typeof input.specialist !== "string" ||
      !(SUPERVISOR_SPECIALISTS as readonly string[]).includes(input.specialist)) {
    throw new CareerContractError(422, "AGENT_PLAN_REJECTED");
  }
  const specialist = input.specialist as SupervisorSpecialist;
  // The bound application read is always inserted server-side even for GENERAL.
  // A model-supplied application ID cannot replace the server-selected ID.
  const proposed = withApplicationContext(input.calls, applicationId);
  const permitted = new Set<CareerReadTool>([...SPECIALIST_READS[specialist], ...(applicationId ? ["get_my_application" as const] : [])]);
  if (proposed.some(call => !permitted.has(call.tool) || !allowedInput(call.tool, call.input) ||
      (call.tool === "get_my_application" && applicationId && call.input.applicationId !== applicationId))) {
    throw new CareerContractError(422, "AGENT_PLAN_REJECTED");
  }
  return { specialist, calls: proposed };
}
