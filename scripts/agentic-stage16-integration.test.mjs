/** Mandatory real-StateGraph smoke gate: never silently pass without dependencies. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register(new URL('./agentic-stage06-loader.mjs',import.meta.url));
async function entry(){
 try{return (await import('../src/lib/agentic/agents/supervisor/agent/supervisor.agent.ts')).runCareerSupervisorAgent;}
 catch(error){if(['ERR_MODULE_NOT_FOUND','MODULE_NOT_FOUND'].includes(error?.code))
    assert.fail('npm dependencies must be installed before real LangGraph integration tests.');throw error;}
}
const input={actorId:'owner',message:'How can I improve my resume?',history:[]};
test('stage16 real LangGraph switches to resume consultation without writing',async()=>{
 const run=await entry();let reads=0;
 const result=await run({input,deps:{
   selectPlan:async()=>({specialist:'resume',calls:[{tool:'list_my_resumes',input:{}}]}),
   readSelected:async calls=>{reads++;assert.equal(calls[0].tool,'list_my_resumes');return {reads:[{tool:'list_my_resumes',source:'self_reported',result:[],truncated:false}],steps:[{tool:'list_my_resumes',status:'completed'}]};},
   respond:async ({specialist})=>{assert.equal(specialist,'resume');return 'Open the CV editor to make reviewed changes.';},
 }});
 assert.equal(reads,1);assert.equal(result.specialist,'resume');assert.equal(result.mode,'read_only');
});
test('stage16 real LangGraph rejects write-tool injection',async()=>{
 const run=await entry();let dispatched=false;
 await assert.rejects(run({input,deps:{
   selectPlan:async()=>({specialist:'application',calls:[{tool:'send_application_email',input:{}}]}),
   readSelected:async()=>{dispatched=true;return {reads:[],steps:[]}},respond:async()=>'',
 }}));
 assert.equal(dispatched,false);
});
