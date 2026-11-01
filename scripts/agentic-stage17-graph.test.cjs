const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,base,career,policy,assembly}=require('./agentic-stage17-fixtures.cjs');
const Annotation=()=>undefined;Annotation.Root=x=>x;
const state=load(base+'agent/state.ts',{'@langchain/langgraph':{Annotation}});
const ctx=load(base+'nodes/context.node.ts',{
 '@/lib/career-os/contracts':career,'../tools/policy.tool':policy});
const verify=load(base+'nodes/verify.node.ts');
class FakeStateGraph {
 constructor(){this.nodes=new Map();this.edges=new Map();}
 addNode(k,fn){this.nodes.set(k,fn);return this;}
 addEdge(a,b){this.edges.set(a,b);return this;}
 compile(){return {invoke:async input=>{
   const s={...input};let k=this.edges.get('__start__');let counter=0;
   while(k&&k!=='__end__'){
     if(++counter>5)throw Error('cycle');
     Object.assign(s,await this.nodes.get(k)(s));
     k=this.edges.get(k);
   }
   return s;
 }};}
}
const traces=[];
const scope={budget:{signal:new AbortController().signal,assertActive(){}},
 step:async(name,fn)=>{traces.push(name);return fn();}};
const graph=load(base+'agent/graph.ts',{
 '@langchain/langgraph':{StateGraph:FakeStateGraph,START:'__start__',END:'__end__'},
 '../../core/nodes/traced-node':{tracedNode:(scope,name,fn)=>s=>scope.step(name,()=>fn(s))},
 './state':state,'../nodes/context.node':ctx,'../nodes/verify.node':verify,
});
const memoryAgent=load(base+'agent/memory.agent.ts',{
 'node:crypto':{randomUUID:()=> 'memory-run'},
 '../../core/execution/runner':{runAgentGraph:async options=>{
   assert.equal(options.identity.agentId,'memory');
   assert.equal(options.identity.access.kind,'authenticated');
   assert.equal(options.timeoutMs,8000);
   return options.createGraph(scope).invoke(options.input);
 }},
 './graph':graph,'./state':state,
 '../nodes/read.node':{loadCareerMemoryForAgent:()=>{throw Error('unexpected DB');}},
 '@/lib/career-os/contracts':career,
});

test('stage17 LangGraph context/read/verify executes scoped memory once',async()=>{
 traces.length=0;let count=0;
 const got=await memoryAgent.runCareerMemoryAgent({actorId:'alice',agentId:'supervisor',missionId:'mission-1',
   load:async (actor,agent,mission)=>{
     count++;assert.equal(actor,'alice');assert.equal(agent,'supervisor');assert.equal(mission,'mission-1');
     return {preferences:[{key:'response_language',value:'fr'}],mission:{id:'mission-1',title:'Job search',revision:0,status:'ACTIVE',completedRuns:1,pendingApprovals:0}};
   }});
 assert.equal(count,1);assert.equal(got.preferences[0].value,'fr');
 assert.deepEqual(traces,['memory.context','memory.read','memory.verify']);
});

test('stage17 graph rejects missing actor before private retrieval',async()=>{
 let count=0;
 await assert.rejects(graph.createCareerMemoryGraph(scope,async()=>{count++;return {preferences:[]};}).invoke({actorId:'',agentId:'supervisor'}),e=>e.code==='UNAUTHORIZED');
 assert.equal(count,0);
});

test('stage17 graph rejects unapproved agent before any data read',async()=>{
 let count=0;
 await assert.rejects(graph.createCareerMemoryGraph(scope,async()=>{count++;return {preferences:[]};}).invoke({actorId:'alice',agentId:'ats'}),e=>e.code==='MEMORY_SCOPE_FORBIDDEN');
 assert.equal(count,0);
});

test('stage17 graph rejects unbounded data, never returns partial memory',async()=>{
 await assert.rejects(graph.createCareerMemoryGraph(scope,async()=>({preferences:[{key:'target_role',value:'X'.repeat(125)}]}))
   .invoke({actorId:'alice',agentId:'supervisor'}),/MEMORY_CONTEXT_INVALID/);
 await assert.rejects(graph.createCareerMemoryGraph(scope,async()=>({preferences:Array.from({length:9},()=>({key:'cv_market',value:'fr'}))}))
   .invoke({actorId:'alice',agentId:'supervisor'}),/MEMORY_CONTEXT_INVALID/);
});

test('stage17 preserves trusted mission not-found error and prevents fabricated fallback',async()=>{
 await assert.rejects(memoryAgent.runCareerMemoryAgent({actorId:'alice',agentId:'supervisor',missionId:'another',
   load:async()=>{throw new career.CareerContractError(404,'MISSION_NOT_FOUND');}
 }),e=>e.code==='MISSION_NOT_FOUND'&&e.status===404);
});

test('stage17 no database checkpoint, model invocation or writable tool inside memory graph',()=>{
 const fs=require('node:fs');const path=require('node:path');
 const root=path.resolve(__dirname,'..');
 for(const name of ['agent/graph.ts','agent/memory.agent.ts','nodes/context.node.ts','nodes/verify.node.ts']){
   const src=fs.readFileSync(path.join(root,base,name),'utf8');
   assert.doesNotMatch(src,/\.create\(|\.update\(|\.delete\(|\.send\(|checkpointer|\.setup\(/);
 }
});
