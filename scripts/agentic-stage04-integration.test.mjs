/** Mandatory real LangGraph HITL test. npm install is required; no external DB, models or secrets. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

import { AgenticError } from '../src/lib/agentic/core/errors.ts';

test('stage04 REAL LangGraph: interrupt, approval, rejection, stale revision, checkpoint replay', async () => {
  let langgraph, createReviewDemoGraph;
  try {
    langgraph=await import('@langchain/langgraph');
    ({createReviewDemoGraph}=await import('../src/lib/agentic/agents/demo/agent/review-graph.ts'));
  } catch (error) {
    if (error?.code==='ERR_MODULE_NOT_FOUND' || error?.code==='MODULE_NOT_FOUND') {
      assert.fail('Install project npm dependencies; LangGraph integration cannot be skipped.');
    }
    throw error;
  }
  const {MemorySaver,Command}=langgraph;
  const actorId=randomUUID();
  const identity={runId:randomUUID(),agentId:'demo',access:{kind:'authenticated',actorId}};
  const saver=new MemorySaver();
  let version='v1';
  const writes=new Map();
  const createGraph=missionId=>createReviewDemoGraph({identity,missionId,checkpointer:saver,
    getRevision:()=>version, record(key){writes.set(key,(writes.get(key)||0)+1);}});
  const missionId=randomUUID();
  const graph=createGraph(missionId);
  const config={configurable:{thread_id:`demo-${randomUUID()}`}};
  const pending=await graph.invoke({resourceId:'demo-resource',revision:'v1'},config);
  assert.equal(pending.__interrupt__?.length,1);
  const challenge=pending.__interrupt__[0].value;
  assert.equal(challenge.kind,'agent.tool.approval');
  assert.equal(writes.size,0);
  assert.deepEqual(Object.keys(challenge).sort(),['approvalId','kind','resourceId','revision','toolName']);
  const resumed=await graph.invoke(new Command({resume:{approvalId:challenge.approvalId,decision:'approve'}}),config);
  assert.equal(resumed.result,'approved');
  assert.equal([...writes.values()].reduce((a,b)=>a+b,0),1);

  const configReject={configurable:{thread_id:`demo-${randomUUID()}`}};
  const rejected=await graph.invoke({resourceId:'demo-resource',revision:'v1'},configReject);
  await assert.rejects(graph.invoke(new Command({resume:{approvalId:rejected.__interrupt__[0].value.approvalId,decision:'reject'}}),configReject),
    e=>e instanceof AgenticError && e.code==='AGENT_APPROVAL_REJECTED');
  assert.equal([...writes.values()].reduce((a,b)=>a+b,0),1);

  const configStale={configurable:{thread_id:`demo-${randomUUID()}`}};
  const stale=await graph.invoke({resourceId:'demo-resource',revision:'v1'},configStale);
  version='v2';
  await assert.rejects(graph.invoke(new Command({resume:{approvalId:stale.__interrupt__[0].value.approvalId,decision:'approve'}}),configStale),
    e=>e instanceof AgenticError && e.code==='AGENT_TOOL_FORBIDDEN');
  assert.equal([...writes.values()].reduce((a,b)=>a+b,0),1);
});
