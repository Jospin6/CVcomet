import type { AgentRunIdentity } from "../../../core/contracts.ts";
import { AgenticError } from "../../../core/errors.ts";
import type { ResumeAgentInput, ResumeAgentDraft } from "../agent/state";

export type ResumeGenerator = (input: {
  document: ResumeAgentInput["document"];
  instruction: string;
  language: "fr" | "en";
  profileFacts: unknown;
  linkedJobAdvert: unknown;
  selectedField?: string;
  targetField?: string;
  signal?: AbortSignal;
  history?: { role: "user" | "assistant"; content: string }[];
  optInMemory?: { key: string; value: string }[];
}) => Promise<ResumeAgentDraft>;

export type ResumeAgentDependencies = Readonly<{
  /** Injectable for no-provider, no-DB integration tests. */
  generate?: ResumeGenerator;
  /** Must reserve one RESUME_EDIT quota before the first model call. */
  reserveQuota?: (actorId: string) => Promise<unknown>;
}>;

/** Existing provider + quota, not a new billing or model configuration. */
export async function generateResumeEditTool(
  identity: AgentRunIdentity,
  input: ResumeAgentInput,
  deps: ResumeAgentDependencies,
  signal: AbortSignal,
): Promise<ResumeAgentDraft> {
  if (identity.agentId !== "resume" || identity.access.kind !== "authenticated") {
    throw new AgenticError("AGENT_ACCESS_DENIED", 403);
  }
  if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
  const reserve = deps.reserveQuota ?? (async (actorId: string) => {
    const { reserveProfileAI } = await import("@/lib/career-profile/ai");
    return reserveProfileAI(actorId, "RESUME_EDIT");
  });
  try {
    await reserve(identity.access.actorId);
  } catch (error) {
    if (error instanceof AgenticError) throw error;
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (["AI_LIMIT", "AI_HOURLY_LIMIT", "AI_MONTHLY_LIMIT", "AI_RATE_LIMIT"].includes(String(code))) {
      throw new AgenticError("AGENT_MODEL_QUOTA_DENIED", 429);
    }
    throw new AgenticError("AGENT_MODEL_UNAVAILABLE", 503);
  }
  if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
  const generate = deps.generate ?? (await import("@/lib/resume-conversation-ai")).generateResumeConversation;
  // Real provider only: mocked unit-test generators remain independent of the database.
  const optInMemory = deps.generate ? [] : (await (await import("@/lib/agentic/memory/agent/memory.agent"))
    .runCareerMemoryAgent({ actorId: identity.access.actorId, agentId: "resume", signal })).preferences;
  let result: ResumeAgentDraft;
  try {
    result = await generate({
    document: input.document,
    instruction: input.instruction,
    language: input.language,
    profileFacts: input.profileFacts,
    linkedJobAdvert: input.linkedJobAdvert,
    selectedField: input.selectedField,
    targetField: input.targetField,
    signal,
    history: input.history ? [...input.history] : undefined,
    optInMemory,
    });
  } catch (error) {
    if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
    if (error instanceof AgenticError) throw error;
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "AI_TIMEOUT") throw new AgenticError("AGENT_DEADLINE_EXCEEDED", 504);
    if (["AI_LIMIT", "AI_HOURLY_LIMIT", "AI_MONTHLY_LIMIT", "AI_RATE_LIMIT"].includes(String(code))) {
      throw new AgenticError("AGENT_MODEL_QUOTA_DENIED", 429);
    }
    throw new AgenticError("AGENT_MODEL_UNAVAILABLE", 503);
  }
  if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
  return result;
}
