import { StateGraph, START, END } from "@langchain/langgraph";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { tracedNode } from "../../../core/nodes/traced-node.ts";
import { ApplicationPacketState, ApplicationSuggestionState } from "./state";
import { applicationPacketContextNode, applicationSuggestionContextNode } from "../nodes/context.node";
import { applicationPacketDraftNode } from "../nodes/draft.node";
import { createApplicationGenerateNode } from "../nodes/generate.node";
import { applicationPacketVerifyNode, createApplicationSuggestionVerifyNode } from "../nodes/verify.node";
import { applicationPacketAssembleNode, applicationSuggestionAssembleNode } from "../nodes/assemble.node";
import type { ApplicationSuggestionDependencies } from "../tools/contracts.tool";

export function createApplicationPacketGraph(scope: ExecutionScope) {
  return new StateGraph(ApplicationPacketState)
    .addNode("context", tracedNode(scope, "application.packet.context", applicationPacketContextNode))
    .addNode("draft", tracedNode(scope, "application.packet.draft", applicationPacketDraftNode))
    .addNode("verify", tracedNode(scope, "application.packet.verify", applicationPacketVerifyNode))
    .addNode("assemble", tracedNode(scope, "application.packet.assemble", applicationPacketAssembleNode))
    .addEdge(START, "context").addEdge("context", "draft")
    .addEdge("draft", "verify").addEdge("verify", "assemble")
    .addEdge("assemble", END).compile();
}

export function createApplicationSuggestionGraph(scope: ExecutionScope, deps: ApplicationSuggestionDependencies) {
  return new StateGraph(ApplicationSuggestionState)
    .addNode("context", tracedNode(scope, "application.suggestion.context", applicationSuggestionContextNode))
    .addNode("generate", tracedNode(scope, "application.suggestion.generate", createApplicationGenerateNode(scope, deps)))
    .addNode("verify", tracedNode(scope, "application.suggestion.verify", createApplicationSuggestionVerifyNode(deps)))
    .addNode("assemble", tracedNode(scope, "application.suggestion.assemble", applicationSuggestionAssembleNode))
    .addEdge(START, "context").addEdge("context", "generate")
    .addEdge("generate", "verify").addEdge("verify", "assemble")
    .addEdge("assemble", END).compile();
}
