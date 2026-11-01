/** Mandatory real LangGraph/SSE-events gate: npm ci + prisma generate required. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register(new URL('./agentic-stage06-loader.mjs', import.meta.url));

test('stage18 real StateGraph emits technical progress but not model text',async()=>{
  let runner,langgraph;
  try {
    runner=await import('../src/lib/agentic/core/execution/runner.ts');
    langgraph=await import('@langchain/langgraph');
  } catch(error){
    if(['ERR_MODULE_NOT_FOUND','MODULE_NOT_FOUND'].includes(error?.code))
      assert.fail('Real LangGraph test requires installed dependencies: npm ci && npx prisma generate');
    throw error;
  }
  const {StateGraph,Annotation,START,END}=langgraph;
  const GraphState=Annotation.Root({message:Annotation()});
  const events=[];
  const answer=await runner.runAgentGraph({
    identity:{runId:'stage18-test',agentId:'supervisor',access:{kind:'authenticated',actorId:'stage18-actor'}},
    input:{message:'private user text'},timeoutMs:3000,onEvent:event=>events.push(event),
    createGraph:scope=>new StateGraph(GraphState)
      .addNode('work',async()=>scope.step('supervisor.context',()=>({message:'Private final answer (not in events)'})))
      .addEdge(START,'work').addEdge('work',END).compile(),
  });
  assert.equal(answer.message,'Private final answer (not in events)');
  assert.deepEqual(events.map(e=>e.kind),['run.started','step.started','step.completed','run.completed']);
  assert.equal(JSON.stringify(events).includes('Private final answer'),false);
  assert.equal(JSON.stringify(events).includes('private user text'),false);
});
