import { randomUUID } from "node:crypto";
import type { AgentRunIdentity } from "../../../core/contracts.ts";
import { AgenticError } from "../../../core/errors.ts";
import { runAgentGraph } from "../../../core/execution/runner.ts";
import { resumeContentSchema } from "@/lib/resume-editor";
import type { AtsAgentDependencies } from "../tools/analysis.tool";
import { createAtsAgentGraph } from "./graph";
import { AtsAgentState, type AtsAgentInput } from "./state";
import type { AtsExecutionProgress } from "./progress";
import { planAtsAnalysis } from "../tools/plan.tool";
import { prepareAtsModel, runAtsEvidenceReview, runAtsJobMatch } from "../tools/analysis.tool";
import { assembleAtsReport } from "../tools/assemble.tool";
import { verifyAtsReport } from "../tools/verify.tool";
import type { SemanticReview, AtsJobMatch } from "@/lib/career/ats-types";

/** Called only after the API has checked CV and saved-job ownership.
 * Generates an analysis; the existing API owns caching and persistence. */
export async function runAtsAgent(options: {
  actorId: string;
  input: AtsAgentInput;
  signal?: AbortSignal;
  deps?: AtsAgentDependencies;
}) {
  if (!options.actorId?.trim()) throw new AgenticError("AGENT_INVALID_IDENTITY", 401);
  if (!options.input ||
    (options.input.keywords?.length ?? 0) > 60 ||
    options.input.keywords?.some(term => typeof term !== "string" || term.length > 100) ||
    (options.input.jobDescription?.length ?? 0) > 50_000 ||
    (options.input.language !== undefined && !["fr", "en"].includes(options.input.language))) {
    throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400);
  }
  const input: AtsAgentInput = {
    ...options.input,
    resume: resumeContentSchema.parse(options.input.resume),
    language: options.input.language ?? "en",
  };
  const identity: AgentRunIdentity = {
    runId: randomUUID(), agentId: "ats",
    access: { kind: "authenticated", actorId: options.actorId },
  };
  const progress: AtsExecutionProgress = { started: new Set(), values: {} };
  try {
    const state = await runAgentGraph<Partial<typeof AtsAgentState.State>, typeof AtsAgentState.State>({
      identity,
      input: { input },
      createGraph: scope => createAtsAgentGraph(scope, options.deps, progress),
      signal: options.signal,
      timeoutMs: 85_000,
      recursionLimit: 14,
    });
    if (!state.verified || !state.report) throw new AgenticError("AGENT_RUN_FAILED", 502);
    return state.report;
  } catch (error) {
    // No recovery from explicit user cancellation or authorization failure.
    if (options.signal?.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
    if (error instanceof AgenticError && ["AGENT_ACCESS_DENIED", "AGENT_INVALID_IDENTITY", "AGENT_MODEL_INPUT_INVALID", "AGENT_CANCELLED"].includes(error.code)) throw error;
    const code = error instanceof AgenticError ? error.code : "AGENT_RUN_FAILED";
    console.warn("ATS graph recovery", {
      code,
      lastStep: [...progress.started].at(-1) ?? "before-first-node",
      errorType: error instanceof Error ? error.name : "Unknown",
      // An error message/stack can contain CV content; never log it here.
    });

    // Recover completed values if LangGraph fails during fan-out/join/verify.
    // A started-but-unfinished model step must not be retried: that could
    // reserve quota or bill the provider twice. Such checks stay unassessed.
    const plan = progress.values.plan ?? planAtsAnalysis(input);
    let model = progress.values.model ?? null;
    let modelError = progress.values.modelError ?? "ATS_ENGINE_UNAVAILABLE";
    const canCallModel = !progress.started.has("model") && code !== "AGENT_DEADLINE_EXCEEDED";
    if (canCallModel) {
      const prepared = await prepareAtsModel(identity, options.signal ?? new AbortController().signal, options.deps);
      model = prepared.model;
      modelError = prepared.modelError ?? "ATS_ENGINE_UNAVAILABLE";
    }
    const resumed = { input, plan, model, modelError } as typeof AtsAgentState.State;
    const unavailableReview: SemanticReview = { status: "UNAVAILABLE", error: modelError, criteria: [], issues: [] };
    const semantic = progress.values.semantic ?? (progress.started.has("review") || code === "AGENT_DEADLINE_EXCEEDED"
      ? unavailableReview : await runAtsEvidenceReview(resumed, options.signal ?? new AbortController().signal, options.deps));
    const unavailableJob: AtsJobMatch = plan.jobMode === "none"
      ? { status: "NOT_PROVIDED", score: null, requirements: [] }
      : { status: "UNAVAILABLE", score: null, error: modelError, requirements: [] };
    const jobMatch = progress.values.jobMatch ?? (progress.started.has("job-match") || code === "AGENT_DEADLINE_EXCEEDED"
      ? unavailableJob : await runAtsJobMatch(resumed, options.signal ?? new AbortController().signal, options.deps));
    const report = assembleAtsReport(input, plan.visible, semantic, jobMatch);
    verifyAtsReport(report); // Recovery never bypasses the evidence/score policy.
    if (semantic.status !== "COMPLETE" || (plan.jobMode !== "none" && jobMatch.status !== "COMPLETE")) {
      report.diagnostics = ["ATS_ENGINE_UNAVAILABLE"];
    }
    return report;
  }
}
