import { START, END, StateGraph } from "@langchain/langgraph";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { tracedNode } from "../../../core/nodes/traced-node.ts";
import { VoicePreparationState, VoiceEvaluationState } from "./state";
import { voicePreparationContextNode, voiceEvaluationContextNode } from "../nodes/context.node";
import { voicePrepareNode } from "../nodes/prepare.node";
import { createVoiceGenerateNode } from "../nodes/generate.node";
import { voicePreparationVerifyNode, voiceEvaluationVerifyNode } from "../nodes/verify.node";
import { voicePreparationAssembleNode, voiceEvaluationAssembleNode } from "../nodes/assemble.node";
import type { VoiceDependencies } from "../tools/contracts.tool";

/** Only the pre-call context and post-call report are graphed; audio stays in LiveKit. */
export function createVoicePreparationGraph(scope: ExecutionScope) {
  return new StateGraph(VoicePreparationState)
    .addNode("context", tracedNode(scope, "interview-voice.prepare.context", voicePreparationContextNode))
    .addNode("prepare", tracedNode(scope, "interview-voice.prepare.plan", voicePrepareNode))
    .addNode("verify", tracedNode(scope, "interview-voice.prepare.verify", voicePreparationVerifyNode))
    .addNode("assemble", tracedNode(scope, "interview-voice.prepare.assemble", voicePreparationAssembleNode))
    .addEdge(START, "context").addEdge("context", "prepare")
    .addEdge("prepare", "verify").addEdge("verify", "assemble")
    .addEdge("assemble", END).compile();
}

export function createVoiceEvaluationGraph(scope: ExecutionScope, deps: VoiceDependencies) {
  return new StateGraph(VoiceEvaluationState)
    .addNode("context", tracedNode(scope, "interview-voice.evaluate.context", voiceEvaluationContextNode))
    .addNode("generate", tracedNode(scope, "interview-voice.evaluate.generate", createVoiceGenerateNode(scope, deps)))
    .addNode("verify", tracedNode(scope, "interview-voice.evaluate.verify", voiceEvaluationVerifyNode))
    .addNode("assemble", tracedNode(scope, "interview-voice.evaluate.assemble", voiceEvaluationAssembleNode))
    .addEdge(START, "context").addEdge("context", "generate")
    .addEdge("generate", "verify").addEdge("verify", "assemble")
    .addEdge("assemble", END).compile();
}
