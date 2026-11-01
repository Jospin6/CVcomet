/** Requires installed real @langchain/langgraph and the configured TS loader.
 * Never silently skips a missing graph runtime. No database/provider calls. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register(new URL('./agentic-stage06-loader.mjs', import.meta.url));
async function entry(){
 try { return (await import('../src/lib/agentic/agents/supervisor/agent/supervisor.agent.ts')).runCareerSupervisorAgent; }
 catch(error) { if (['ERR_MODULE_NOT_FOUND','MODULE_NOT_FOUND'].includes(error?.code))
   assert.fail('Install npm dependencies and generate Prisma client to run the real LangGraph integration test.'); throw error; }
}
const input = {actorId:'owner',message:'Show my career directions',history:[],requestedSpecialist:'career_map'};
test('real LangGraph invokes bounded specialist delegation and returns only verified answer',async()=>{
 const run=await entry();let calls=0;
 const result=await run({input,deps:{
   selectPlan:async()=>({specialist:'career_map',calls:[]}),
   readSelected:async()=>({reads:[],steps:[]}),
   delegateSpecialist:async(specialist,context)=>{ calls++;assert.equal(specialist,'career_map');assert.equal(context.actorId,'owner');
     return {source:'career_map_agent_live_preview',roles:[{id:'ai-engineer',title:'AI Engineer'}]}; },
   respond:async({specialistResult})=>{
     assert.equal(specialistResult?.source,'career_map_agent_live_preview');
     return 'The career map preview is available for review in Career Map.';
   },
 }});
 assert.equal(calls,1);assert.equal(result.mode,'read_only');assert.equal(result.requiresApproval,false);
});
test('real LangGraph rejects injected write tools before delegated agent execution',async()=>{
 const run=await entry();let delegated=false;
 await assert.rejects(run({input,deps:{
   selectPlan:async()=>({specialist:'application',calls:[{tool:'submit_application',input:{}}]}),
   readSelected:async()=>({reads:[],steps:[]}),
   delegateSpecialist:async()=>{delegated=true;return null},
   respond:async()=> 'no',
 }}));
 assert.equal(delegated,false);
});
