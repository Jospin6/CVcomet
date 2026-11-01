import type { VoiceEvaluationState } from "../agent/state";
import type { VoiceDependencies } from "../tools/contracts.tool";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { countUsableAnswers } from "@/lib/career/screening-policy";
import { AgenticError } from "../../../core/errors.ts";

export function createVoiceGenerateNode(scope: ExecutionScope, deps: VoiceDependencies) {
  return async (state: typeof VoiceEvaluationState.State) => {
    if (!deps.evaluateTranscript || countUsableAnswers(state.input.turns) < 2) return { draft: null };
    try {
      scope.budget.assertActive();
      const draft = await deps.evaluateTranscript(state.input, scope.budget.signal);
      scope.budget.assertActive();
      return { draft };
    } catch (error) {
      scope.budget.assertActive();
      if (error instanceof AgenticError) throw error;
      // Never fall back to synthetic scores on model or quota errors.
      return { draft: null };
    }
  };
}
