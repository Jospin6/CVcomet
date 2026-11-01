/** Real LangGraph integration. Requires npm ci and Prisma client generate. No external DB call. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register(new URL('./agentic-stage06-loader.mjs',import.meta.url));

test('stage19 actual StateGraph evaluates bounded metadata with no model or DB access',async()=>{
 let agent;
 try { agent=await import('../src/lib/agentic/agents/evaluation/agent/evaluation.agent.ts');
  await import('@langchain/langgraph');
 } catch(error) {
  if(['ERR_MODULE_NOT_FOUND','MODULE_NOT_FOUND'].includes(error?.code))
    assert.fail('Real LangGraph/Prisma integration requires npm ci && npx prisma generate');
  throw error;
 }
 const now=new Date('2026-11-01T00:00:00.000Z');
 let count=0;
 const result=await agent.runEvaluationAgent({adminId:'stage19-admin',now,deps:{read:async(from,until)=>{
  count++;assert.equal(until.getTime()-from.getTime(),7*86400000);
  return {
   career:{scope:'career_agent_only',from:from.toISOString(),until:until.toISOString(),total:0,completed:0,failed:0,
    observedSuccessRate:null,latencyMs:{p50:null,p95:null,sampledCompleted:0,totalCompleted:0,sampleCap:1000},errors:[],
    feedback:{helpful:0,notHelpful:0,total:0,positiveShare:null,note:'Voluntary'},excluded:[],note:'Partial'},
   runStatuses:[],progressEvents:[],expiredRunningLeases:0,
   aiUsage:{trackedCalls:0,pricedCalls:0,inputTokens:null,outputTokens:null,estimatedUSD:null},
  };
 }}});
 assert.equal(count,1);
 assert.equal(result.scope,'agentic_operational_partial');
 assert.equal(result.decision,'REQUIRES_REVIEW');
 assert.equal(result.gates.find(x=>x.key==='groundedness_and_hiring_claims').status,'NOT_MEASURED');
 assert.equal(JSON.stringify(result).includes('stage19-admin'),false);
});
