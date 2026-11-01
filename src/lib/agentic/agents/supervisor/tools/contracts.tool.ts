import type { AssistantAttachment } from "./multimodal.tool";
import type { AgentCall, AgentRead, AgentStep } from "@/lib/career-os/agent-engine";
import type { AgentHistoryMessage } from "@/lib/career-os/mission-policy";

export const SUPERVISOR_SPECIALISTS = [
  "general", "profile", "resume", "cover_letter", "ats", "job_match",
  "job_discovery", "career_map", "interview_text", "interview_voice", "application",
] as const;
export type SupervisorSpecialist = typeof SUPERVISOR_SPECIALISTS[number];

export type SupervisorInput = Readonly<{
  actorId: string;
  message: string;
  history: readonly AgentHistoryMessage[];
  applicationId?: string;
  attachments?: readonly AssistantAttachment[];
  requestedSpecialist?: SupervisorSpecialist;
}>;
export type SupervisorPlan = Readonly<{ specialist: SupervisorSpecialist; calls: AgentCall[] }>;
export type SupervisorDependencies = Readonly<{
  selectPlan: (input: SupervisorInput, signal: AbortSignal) => Promise<unknown>;
  readSelected: (calls: AgentCall[], signal: AbortSignal) => Promise<{ reads: AgentRead[]; steps: AgentStep[] }>;
  delegateSpecialist?: (specialist: SupervisorSpecialist, context: SupervisorInput, signal: AbortSignal) => Promise<unknown | null>;
  respond: (input: { context: SupervisorInput; specialist: SupervisorSpecialist; reads: AgentRead[]; specialistResult?: unknown }, signal: AbortSignal) => Promise<string>;
}>;
export type SupervisorOutput = Readonly<{
  message: string;
  steps: AgentStep[];
  specialist: SupervisorSpecialist;
  mode: "read_only";
  requiresApproval: false;
}>;
