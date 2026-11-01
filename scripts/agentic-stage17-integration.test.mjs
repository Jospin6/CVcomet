/** Mandatory REAL LangGraph integration. Requires npm ci, prisma generate, and its dependencies. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register(new URL('./agentic-stage06-loader.mjs',import.meta.url));

async function entry(){
  try { return (await import('../src/lib/agentic/memory/agent/memory.agent.ts')).runCareerMemoryAgent; }
  catch(error){
    if (['ERR_MODULE_NOT_FOUND','MODULE_NOT_FOUND'].includes(error?.code))
      assert.fail('Install project dependencies and run prisma generate before the real LangGraph memory integration test.');
    throw error;
  }
}

test('stage17 real StateGraph reads one user scope and reflects deletion on next turn', async()=>{
  const run=await entry();
  let readCount=0;let entries=[{key:'response_language',value:'fr',allowedAgents:['resume']}];
  const load=async(actor,agent)=>{
    assert.equal(actor,'actor-17');assert.equal(agent,'resume');
    readCount++;
    return {preferences:entries.filter(row=>row.allowedAgents.includes(agent)).map(({key,value})=>({key,value}))};
  };
  const options={actorId:'actor-17',agentId:'resume',load};
  const one=await run(options);
  assert.equal(one.preferences[0].value,'fr');
  entries=[];
  const two=await run(options);
  assert.deepEqual(two.preferences,[]);
  assert.equal(readCount,2);
});

test('stage17 real StateGraph refuses unauthorized or invalid memory access',async()=>{
  const run=await entry();
  let reads=0;
  const load=async()=>{reads++;return {preferences:[]};};
  await assert.rejects(run({actorId:'',agentId:'resume',load}));
  await assert.rejects(run({actorId:'actor-17',agentId:'ats',load}));
  assert.equal(reads,0);
});
