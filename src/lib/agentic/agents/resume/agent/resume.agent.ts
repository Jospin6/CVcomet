import { randomUUID } from "node:crypto";
import { resumeAgentApiError } from "./errors";
import { resumeEditorDirectFallback } from "./direct-fallback";
import { resumeContentSchema } from "@/lib/resume-editor";
import { ProfileError } from "@/lib/career-profile/http";
import { AgenticError } from "../../../core/errors.ts";
import { runAgentGraph } from "../../../core/execution/runner.ts";
import type { AgentRunIdentity } from "../../../core/contracts.ts";
import { createResumeAgentGraph } from "./graph";
import { ResumeAgentState, type ResumeAgentInput, type ResumeAgentDraft, type ResumeAgentResult } from "./state";
import type { ResumeAgentDependencies } from "../tools/generate-edit.tool";

/** The editor owns proposals, expiry and human approval. Neither the graph nor
 * its recovery path is permitted to write to the candidate CV or the database. */
export async function runResumeAgent(options: {
  actorId: string;
  input: ResumeAgentInput;
  deps?: ResumeAgentDependencies;
  signal?: AbortSignal;
}) {
  const identity: AgentRunIdentity = {
    runId: randomUUID(), agentId: "resume",
    access: { kind: "authenticated", actorId: options.actorId },
  };
  if (typeof options.input.instruction !== "string" ||
      !options.input.instruction.trim() || options.input.instruction.length > 4_000 ||
      !["fr", "en"].includes(options.input.language) ||
      (options.input.history?.length ?? 0) > 8 ||
      (options.input.history?.some(row => !["user", "assistant"].includes(row.role) ||
        typeof row.content !== "string" || row.content.length > 4_000)) ||
      (options.input.targetField && options.input.targetField.length > 100)) {
    throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400);
  }
  const input = { ...options.input, document: resumeContentSchema.parse(options.input.document) };
  const startedAt = Date.now();
  let stepFailed: string | undefined;
  let generationStarted = false;
  let generatedDraft: ResumeAgentDraft | undefined;
  const deps: ResumeAgentDependencies = {
    ...options.deps,
    onGenerationStarted: () => {
      generationStarted = true;
      options.deps?.onGenerationStarted?.();
    },
    onDraftGenerated: draft => {
      generatedDraft = draft;
      options.deps?.onDraftGenerated?.(draft);
    },
  };
  let result: ResumeAgentResult;
  try {
    const state = await runAgentGraph<Partial<typeof ResumeAgentState.State>, typeof ResumeAgentState.State>({
      identity,
      input: { input },
      createGraph: scope => createResumeAgentGraph(scope, deps),
      signal: options.signal,
      onEvent: event => {
        if (event.kind === "step.failed") {
          stepFailed = event.step;
          // Only fixed step names and safe error codes. Never log CV fields.
          console.warn("Resume agent step failed", { step: event.step, code: event.code });
        }
      },
      timeoutMs: 55_000,
      recursionLimit: 12,
    });
    if (!state.result || !state.result.object ||
      (state.result.object.status === "applied" && (!state.readyForReview || !state.result.document))) {
      throw new AgenticError("AGENT_RUN_FAILED", 502);
    }
    result = state.result;
  } catch (error) {
    const code = error instanceof AgenticError ? error.code : "AGENT_RUN_FAILED";
    const fallbackEligible = (code === "AGENT_RUN_FAILED" || code === "AGENT_STEP_FAILED") &&
      !options.signal?.aborted &&
      // A failed generation must NEVER be silently replayed: avoid double quota/use.
      (!generationStarted || !!generatedDraft) &&
      // A 55s graph timeout has no safe time left for another model request.
      Date.now() - startedAt < 40_000;
    console.error("Resume editor graph failure", {
      code,
      step: stepFailed ?? "graph-runtime",
      errorType: error instanceof Error ? error.name : "UnknownError",
      recovery: fallbackEligible ? (generatedDraft ? "reuse-draft" : "start-once") : "disabled",
    });
    if (!fallbackEligible) throw resumeAgentApiError(error);

    try {
      const remaining = Math.max(1, 50_000 - (Date.now() - startedAt));
      const deadline = AbortSignal.timeout(remaining);
      const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
      result = await resumeEditorDirectFallback({
        identity, input, deps, signal, existingDraft: generatedDraft,
      });
      console.info("Resume editor recovered without duplicate model call", {
        stage: stepFailed ?? "graph-runtime",
        reusedDraft: !!generatedDraft,
      });
    } catch (recoveryError) {
      const recoveryCode = recoveryError instanceof AgenticError ? recoveryError.code :
        recoveryError instanceof ProfileError ? recoveryError.code : "UNCLASSIFIED";
      // Explicitly preserve the safe error classification; no raw data in logs.
      console.error("Resume editor recovery failed", {
        code: recoveryCode,
        errorType: recoveryError instanceof Error ? recoveryError.name : "UnknownError",
      });
      throw resumeAgentApiError(recoveryError);
    }
  }
  if (!result.object || (result.object.status === "applied" && !result.document)) {
    throw new ProfileError(502, "AI_INVALID_RESPONSE");
  }
  return result;
}
