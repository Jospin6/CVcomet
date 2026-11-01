import type { LanguageModel } from "ai";
import { getAIModel } from "@/lib/ai/model";
import { reserveProfileAI } from "@/lib/career-profile/ai";
import { ProfileError, profileAIError } from "@/lib/career-profile/http";
import { emptyProfile } from "@/lib/career-profile/schema";
import { reviewAtsContent } from "@/lib/career/ats-review";
import { analyzeJobDescription, matchJob } from "@/lib/career/job-match";
import { assessAtsJobMatch } from "@/lib/career/ats-job-match";
import type { JobAnalysis } from "@/lib/career/job-schema";
import type { EditorResume } from "@/lib/resume-editor";
import type { AtsAgentState } from "../agent/state";
import type { SemanticReview, AtsJobMatch } from "@/lib/career/ats-types";
import type { AgentRunIdentity } from "../../../core/contracts.ts";
import { AgenticError } from "../../../core/errors.ts";

/** DI permits graph-level tests without real model calls, credits or private data. */
export type AtsAgentDependencies = Partial<{
  acquireModel: (actorId: string, signal: AbortSignal) => Promise<LanguageModel>;
  review: (resume: EditorResume, language: "fr" | "en", model: LanguageModel, signal: AbortSignal) => Promise<SemanticReview>;
  extractJob: (description: string, language: "fr" | "en", model: LanguageModel) => Promise<JobAnalysis>;
}>;

const code = (error: unknown) => error instanceof ProfileError ? error.code : profileAIError(error).code;
const unavailable = (error: string): SemanticReview => ({ status: "UNAVAILABLE", error, criteria: [], issues: [] });
const notProvided = (): AtsJobMatch => ({ status: "NOT_PROVIDED", score: null, requirements: [] });

/** Quota reserved exactly once and only after a provider is available. */
export async function prepareAtsModel(identity: AgentRunIdentity, signal: AbortSignal, deps: AtsAgentDependencies = {}) {
  if (identity.agentId !== "ats" || identity.access.kind !== "authenticated") {
    throw new AgenticError("AGENT_ACCESS_DENIED", 403);
  }
  if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
  try {
    const model = deps.acquireModel
      ? await deps.acquireModel(identity.access.actorId, signal)
      : await getAIModel({ structuredOutputs: true });
    if (!deps.acquireModel) await reserveProfileAI(identity.access.actorId, "ATS_REVIEW");
    return { model, modelError: null };
  } catch (error) {
    if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
    return { model: null, modelError: code(error) };
  }
}

/** Never fabricate a 100-point content score when model review is unavailable. */
export async function runAtsEvidenceReview(
  state: typeof AtsAgentState.State, signal: AbortSignal, deps: AtsAgentDependencies = {},
): Promise<SemanticReview> {
  if (!state.model) return unavailable(state.modelError ?? "AI_UNAVAILABLE");
  try {
    return await (deps.review ?? reviewAtsContent)(state.plan.visible, state.input.language ?? "en", state.model, signal);
  } catch (error) {
    if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
    return unavailable(code(error));
  }
}

/** Job alignment uses only VISIBLE resume fields; never the complete career profile. */
export async function runAtsJobMatch(
  state: typeof AtsAgentState.State, signal: AbortSignal, deps: AtsAgentDependencies = {},
): Promise<AtsJobMatch> {
  const { jobMode, savedAnalysis, visible } = state.plan;
  if (jobMode === "none") return notProvided();
  if (savedAnalysis) return assessAtsJobMatch(visible, matchJob(emptyProfile(), savedAnalysis, visible));
  if (!state.model) return { status: "UNAVAILABLE", score: null, error: state.modelError ?? "AI_UNAVAILABLE", requirements: [] };
  try {
    const job = deps.extractJob
      ? await deps.extractJob(state.input.jobDescription ?? "", state.input.language ?? "en", state.model)
      : await analyzeJobDescription(state.input.jobDescription ?? "", undefined, state.input.language ?? "en", state.model);
    return assessAtsJobMatch(visible, matchJob(emptyProfile(), job, visible));
  } catch (error) {
    if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
    return { status: "UNAVAILABLE", score: null, error: code(error), requirements: [] };
  }
}
