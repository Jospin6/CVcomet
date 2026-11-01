import { END, START, StateGraph } from "@langchain/langgraph";
import type { CareerProfile } from "@/lib/career-profile/schema";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { tracedNode } from "../../../core/nodes/traced-node.ts";
import { createLoadProfileNode } from "../nodes/load-profile.node";
import { createExtractNode } from "../nodes/extract.node";
import { reconcileNode } from "../nodes/reconcile.node";
import { createVerifyNode } from "../nodes/verify.node";
import { reviewNode } from "../nodes/review.node";
import type { ProfileResumeDocument } from "../tools/extract-resume.tool";
import type { ExtractedProfile } from "./state";
import { ProfileAgentState } from "./state";

export type ProfileAgentDependencies = Readonly<{
  document: ProfileResumeDocument;
  readProfile?: (actorId: string) => Promise<CareerProfile>;
  extract?: (document: ProfileResumeDocument, signal: AbortSignal) => Promise<ExtractedProfile>;
}>;

/** A real five-step LangGraph, using the existing profile database and model APIs.
 * No checkpointer: raw candidate facts cannot be persisted as graph state.
 * A user confirms and saves the proposed draft through the existing PUT route. */
export function createProfileAgentGraph(scope: ExecutionScope, deps: ProfileAgentDependencies) {
  return new StateGraph(ProfileAgentState)
    .addNode("load_profile", tracedNode(scope, "profile.load", createLoadProfileNode(scope, deps.readProfile)))
    .addNode("extract", tracedNode(scope, "profile.extract", createExtractNode(scope, deps.document, deps.extract)))
    .addNode("verify", tracedNode(scope, "profile.verify", createVerifyNode(deps.document.text)))
    .addNode("reconcile", tracedNode(scope, "profile.reconcile", reconcileNode))
    .addNode("review", tracedNode(scope, "profile.review", reviewNode))
    .addEdge(START, "load_profile")
    .addEdge("load_profile", "extract")
    .addEdge("extract", "verify")
    .addEdge("verify", "reconcile")
    .addEdge("reconcile", "review")
    .addEdge("review", END)
    .compile();
}
