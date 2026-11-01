import { Annotation } from "@langchain/langgraph";
import type { EvaluationEvidence, EvaluationOverview } from "../tools/contracts.tool";

/** Strictly metadata-only, ephemeral graph; never store evaluation snapshots in checkpoints. */
export const EvaluationState = Annotation.Root({
  from: Annotation<Date>,
  until: Annotation<Date>,
  evidence: Annotation<EvaluationEvidence>,
  view: Annotation<Omit<EvaluationOverview, "gates" | "decision">>,
  result: Annotation<EvaluationOverview>,
  verified: Annotation<boolean>,
});
