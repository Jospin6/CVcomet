const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,base,metrics,policy,now,from,evidence}=require('./agentic-stage19-fixtures.cjs');
class AgenticError extends Error {constructor(code,status){super(code);this.code=code;this.status=status;}}
const errors={'../../../core/errors.ts':{AgenticError}};
const Annotation=()=>undefined;Annotation.Root=x=>x;
const state=load(base+'agent/state.ts',{'@langchain/langgraph':{Annotation}});
const nodes={
 context:load(base+'nodes/context.node.ts',errors),
 measure:load(base+'nodes/measure.node.ts',{'../tools/metrics.tool':metrics}),
 gate:load(base+'nodes/gate.node.ts',{'../tools/policy.tool':policy}),
 verify:load(base+'nodes/verify.node.ts',errors),
};
class FakeStateGraph {
 constructor(){this.nodes=new Map();this.edges=new Map();}
 addNode(name,fn){this.nodes.set(name,fn);return this;}
 addEdge(a,b){this.edges.set(a,b);return this;}
 compile(){const self=this;return {async invoke(input){
  let current={...input},node=self.edges.get('START'),hops=0;
  while(node!=='END'){if(++hops>8)throw Error('cycle');
   current={...current,...await self.nodes.get(node)(current)};node=self.edges.get(node);
  }
  return current;
 }};}
}
const events=[];
const tracedNode=(scope,name,fn)=>data=>scope.step(name,()=>fn(data));
const scope={budget:{assertActive(){}},step:async(name,fn)=>{events.push(name);return await fn();}};
const graph=load(base+'agent/graph.ts',{
 '@langchain/langgraph':{START:'START',END:'END',StateGraph:FakeStateGraph},
 '../../../core/nodes/traced-node.ts':{tracedNode},'./state':state,
 '../nodes/context.node':nodes.context,'../nodes/measure.node':nodes.measure,
 '../nodes/gate.node':nodes.gate,'../nodes/verify.node':nodes.verify,
});

test('stage19: five distinct graph nodes evaluate metadata in order',async()=>{
 events.length=0;let reads=0;
 const final=await graph.createEvaluationGraph(scope,{read:async(a,b)=>{
  assert.equal(a.getTime(),from.getTime());assert.equal(b.getTime(),now.getTime());reads++;
  return evidence();
 }}).invoke({from,until:now});
 assert.equal(final.verified,true);assert.equal(reads,1);
 assert.equal(final.result.decision,'REQUIRES_REVIEW');
 assert.deepEqual(events,['evaluation.context','evaluation.read','evaluation.measure','evaluation.gate','evaluation.verify']);
 assert.doesNotMatch(JSON.stringify(final.result),/password/);
});

test('stage19: rejects invalid evaluation time windows before DB read',async()=>{
 let reads=0;
 await assert.rejects(graph.createEvaluationGraph(scope,{read:async()=>{reads++;return evidence();}})
   .invoke({from:now,until:now}),{code:'AGENT_MODEL_INPUT_INVALID'});
 assert.equal(reads,0);
});

test('stage19: graph errors from data provider propagate, no synthetic PASS fallback',async()=>{
 await assert.rejects(graph.createEvaluationGraph(scope,{read:async()=>{throw Error('postgres unavailable')}})
   .invoke({from,until:now}),/postgres unavailable/);
});

test('stage19: agent requires admin identity and never returns raw database evidence',async()=>{
 const agent=load(base+'agent/evaluation.agent.ts',{
  'node:crypto':{randomUUID:()=> 'id-1'},
  '../../../core/execution/runner.ts':{runAgentGraph:async config=>{
   assert.equal(config.identity.agentId,'evaluation');assert.equal(config.identity.access.actorId,'admin');
   assert.equal(config.recursionLimit,10);assert.equal(config.timeoutMs,15_000);
   return config.createGraph(scope).invoke(config.input);
  }},
  '../../../core/errors.ts':{AgenticError},
  './state':state,'./graph':graph,
  '../tools/read.tool':{readStage19Evaluation:async()=>{throw Error('must use mock')}} ,
 });
 await assert.rejects(agent.runEvaluationAgent({adminId:''}),{code:'AGENT_ACCESS_DENIED'});
 const data=await agent.runEvaluationAgent({adminId:'admin',now,
   deps:{read:async()=>evidence()}});
 assert.equal(data.scope,'agentic_operational_partial');
 assert.ok(!Object.hasOwn(data,'evidence'));assert.ok(!Object.hasOwn(data,'adminId'));
});
