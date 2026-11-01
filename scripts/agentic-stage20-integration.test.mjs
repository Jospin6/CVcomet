/** Mandatory TRUE runtime smoke (no mocked StateGraph), never silently skipped. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register(new URL('./agentic-stage06-loader.mjs', import.meta.url));

test('stage20 actual LangGraph supervisor runs a scoped read-only branch', async () => {
 let agent;
 try {
   await import('@langchain/langgraph');
   agent = await import('../src/lib/agentic/agents/supervisor/agent/supervisor.agent.ts');
 } catch (error) {
   if (['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'].includes(error?.code))
     assert.fail('Real LangGraph/Prisma integration requires dependencies and prisma generate');
   throw error;
 }
 let calls = 0;
 const result = await agent.runCareerSupervisorAgent({
   input: {actorId:'authenticated-stage20', message:'Help me prepare my CV',history:[]},
   deps: {
     selectPlan:async()=>({specialist:'resume',calls:[{tool:'list_my_resumes',input:{}}]}),
     readSelected:async callsIn=>{calls++;assert.equal(callsIn[0].tool,'list_my_resumes');
       return {reads:[],steps:[{tool:'list_my_resumes',status:'completed'}]};},
     respond:async()=> 'Review any proposed edits in the CV workspace before applying them.',
   },
 });
 assert.equal(calls,1);
 assert.equal(result.mode,'read_only');
 assert.equal(result.requiresApproval,false);
});
