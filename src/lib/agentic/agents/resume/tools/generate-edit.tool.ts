import type { AgentRunIdentity } from "../../../core/contracts.ts";
import { AgenticError } from "../../../core/errors.ts";
import { resumeProviderAgentError } from "../agent/errors";
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
  /** Local per-request orchestration hooks; never persistent and never sent to the client. */
  onGenerationStarted?: () => void;
  onDraftGenerated?: (draft: ResumeAgentDraft) => void;
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
  // Load the provider before reserving a paid call: a missing model module
  // must not consume a quota unit and must not be reported as a user error.
  let generate: ResumeGenerator;
  try {
    generate = deps.generate ?? (await import("@/lib/resume-conversation-ai")).generateResumeConversation;
  } catch (error) {
    throw resumeProviderAgentError(error);
  }
  const reserve = deps.reserveQuota ?? (async (actorId: string) => {
    const { reserveProfileAI } = await import("@/lib/career-profile/ai");
    return reserveProfileAI(actorId, "RESUME_EDIT");
  });
  try {
    await reserve(identity.access.actorId);
  } catch (error) {
    throw resumeProviderAgentError(error);
  }
  if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
  // The memory service is additional context, not a prerequisite for writing.
  // A transient memory failure must not turn every Resume Agent request into AI_FAILED.
  let optInMemory: { key: string; value: string }[] = [];
  if (!deps.generate) {
    try {
      optInMemory = (await (await import("@/lib/agentic/memory/agent/memory.agent"))
        .runCareerMemoryAgent({ actorId: identity.access.actorId, agentId: "resume", signal })).preferences;
    } catch (error) {
      if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
      // Memory is optional; fail closed without preferences and never read other users' data.
      console.warn("Resume optional memory unavailable", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
  let result: ResumeAgentDraft;
  try {
    deps.onGenerationStarted?.();
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
    throw resumeProviderAgentError(error);
  }
  if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
  deps.onDraftGenerated?.(result);
  return result;
}
