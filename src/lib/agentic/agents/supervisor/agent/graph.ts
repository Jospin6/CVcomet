import { StateGraph, START, END } from "@langchain/langgraph";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { tracedNode } from "../../../core/nodes/traced-node.ts";
import { SupervisorState } from "./state";
import { SUPERVISOR_SPECIALISTS, type SupervisorDependencies } from "../tools/contracts.tool";
import { supervisorContextNode } from "../nodes/context.node";
import { createSupervisorRouteNode } from "../nodes/route.node";
import { createSupervisorDelegateNode } from "../nodes/delegate.node";
import { createSupervisorRespondNode } from "../nodes/respond.node";
import { supervisorVerifyNode } from "../nodes/verify.node";
import { supervisorAssembleNode } from "../nodes/assemble.node";

/** One bounded consultation per turn, never chained autonomous subagent writes. */
export function createSupervisorGraph(scope: ExecutionScope, deps: SupervisorDependencies) {
  return new StateGraph(SupervisorState)
    .addNode("context", tracedNode(scope, "supervisor.context", supervisorContextNode))
    .addNode("route", tracedNode(scope, "supervisor.route", createSupervisorRouteNode(scope, deps)))
    .addNode("general", tracedNode(scope, "supervisor.delegate.general", createSupervisorDelegateNode(scope, deps, "general")))
    .addNode("profile", tracedNode(scope, "supervisor.delegate.profile", createSupervisorDelegateNode(scope, deps, "profile")))
    .addNode("resume", tracedNode(scope, "supervisor.delegate.resume", createSupervisorDelegateNode(scope, deps, "resume")))
    .addNode("cover_letter", tracedNode(scope, "supervisor.delegate.cover_letter", createSupervisorDelegateNode(scope, deps, "cover_letter")))
    .addNode("ats", tracedNode(scope, "supervisor.delegate.ats", createSupervisorDelegateNode(scope, deps, "ats")))
    .addNode("job_match", tracedNode(scope, "supervisor.delegate.job_match", createSupervisorDelegateNode(scope, deps, "job_match")))
    .addNode("job_discovery", tracedNode(scope, "supervisor.delegate.job_discovery", createSupervisorDelegateNode(scope, deps, "job_discovery")))
    .addNode("career_map", tracedNode(scope, "supervisor.delegate.career_map", createSupervisorDelegateNode(scope, deps, "career_map")))
    .addNode("interview_text", tracedNode(scope, "supervisor.delegate.interview_text", createSupervisorDelegateNode(scope, deps, "interview_text")))
    .addNode("interview_voice", tracedNode(scope, "supervisor.delegate.interview_voice", createSupervisorDelegateNode(scope, deps, "interview_voice")))
    .addNode("application", tracedNode(scope, "supervisor.delegate.application", createSupervisorDelegateNode(scope, deps, "application")))
    .addNode("respond", tracedNode(scope, "supervisor.respond", createSupervisorRespondNode(scope, deps)))
    .addNode("verify", tracedNode(scope, "supervisor.verify", supervisorVerifyNode))
    .addNode("assemble", tracedNode(scope, "supervisor.assemble", supervisorAssembleNode))
    .addEdge(START, "context")
    .addEdge("context", "route")
    .addConditionalEdges("route", (state: typeof SupervisorState.State) => state.plan.specialist, [...SUPERVISOR_SPECIALISTS])
    .addEdge("general", "respond")
    .addEdge("profile", "respond")
    .addEdge("resume", "respond")
    .addEdge("cover_letter", "respond")
    .addEdge("ats", "respond")
    .addEdge("job_match", "respond")
    .addEdge("job_discovery", "respond")
    .addEdge("career_map", "respond")
    .addEdge("interview_text", "respond")
    .addEdge("interview_voice", "respond")
    .addEdge("application", "respond")
    .addEdge("respond", "verify")
    .addEdge("verify", "assemble")
    .addEdge("assemble", END)
    .compile();
}
