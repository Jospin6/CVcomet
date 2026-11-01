const { test } = require('node:test');
const assert = require('node:assert/strict');
const {load,validation,prompt,preparation,evaluation,draft,AgenticError,base}=require('./agentic-stage14-fixtures.cjs');
const Annotation=()=>undefined;Annotation.Root=x=>x;
const state=load(base+'agent/state.ts',{'@langchain/langgraph':{Annotation}});
const imports={
  '../tools/validation.tool':validation,
  '../prompts/voice.prompt':prompt,
  '../../../core/errors.ts':{AgenticError},
};
const nodes={
  context:load(base+'nodes/context.node.ts',imports),
  prepare:load(base+'nodes/prepare.node.ts',imports),
  generate:load(base+'nodes/generate.node.ts',{...imports,'@/lib/career/screening-policy':load('src/lib/career/screening-policy.ts')}),
  verify:load(base+'nodes/verify.node.ts',imports),
  assemble:load(base+'nodes/assemble.node.ts',imports),
};
const events=[];
class FakeStateGraph {
  constructor(){this.nodes=new Map();this.edges=new Map()}
  addNode(name,fn){this.nodes.set(name,fn);return this}
  addEdge(from,to){this.edges.set(from,to);return this}
  compile(){const self=this;return {async invoke(input){let node=self.edges.get('__start__'),current={...input},n=0;
    while(node && node!=='__end__'){
      if(++n>10)throw Error('Unbounded graph');
      current={...current,...await self.nodes.get(node)(current)};
      node=self.edges.get(node);
    }
    return current;
  }}}
}
const tracedNode=(scope,name,fn)=>s=>scope.step(name,()=>fn(s));
const graph=load(base+'agent/graph.ts',{
  '@langchain/langgraph':{StateGraph:FakeStateGraph,START:'__start__',END:'__end__'},
  '../../../core/nodes/traced-node.ts':{tracedNode},'./state':state,
  '../nodes/context.node':nodes.context,'../nodes/prepare.node':nodes.prepare,
  '../nodes/generate.node':nodes.generate,'../nodes/verify.node':nodes.verify,
  '../nodes/assemble.node':nodes.assemble,
});
const scope={budget:{signal:new AbortController().signal,assertActive(){}},
  step:async(name,fn)=>{events.push(name);return fn()}};

test('stage14 four preparation graph nodes run in order and output room-bound voice instructions',async()=>{
  events.length=0;
  const result=await graph.createVoicePreparationGraph(scope).invoke({input:preparation});
  assert.deepEqual(events,['interview-voice.prepare.context','interview-voice.prepare.plan',
    'interview-voice.prepare.verify','interview-voice.prepare.assemble']);
  assert.equal(result.verified,true);
  assert.equal(result.result.roomName,preparation.roomName);
  assert.match(result.result.instructions,/practice screening interview/);
});

test('stage14 four evaluation graph nodes run in order and verify model-provided evidence',async()=>{
  events.length=0;let calls=0;
  const result=await graph.createVoiceEvaluationGraph(scope,{
    evaluateTranscript:async(input,signal)=>{
      calls++;assert.equal(input.jobTitle,'Backend engineer');assert.equal(signal.aborted,false);return draft;
    },
  }).invoke({input:evaluation});
  assert.equal(calls,1);
  assert.deepEqual(events,['interview-voice.evaluate.context','interview-voice.evaluate.generate',
    'interview-voice.evaluate.verify','interview-voice.evaluate.assemble']);
  assert.equal(result.result.overallScore,80);
});

test('stage14 missing evaluator and downtime never manufacture grades',async()=>{
  for(const deps of [{},{evaluateTranscript:async()=>{throw Error('offline')}}]){
    const result=await graph.createVoiceEvaluationGraph(scope,deps).invoke({input:evaluation});
    assert.equal(result.result.status,'unavailable');
    assert.equal(result.result.overallScore,null);
  }
});

test('stage14 insufficient user answers skip the paid model entirely',async()=>{
  let called=0;
  const result=await graph.createVoiceEvaluationGraph(scope,{evaluateTranscript:async()=>{called++;return draft}})
    .invoke({input:{...evaluation,turns:[evaluation.turns[1]]}});
  assert.equal(called,0);
  assert.equal(result.result.reason,'INSUFFICIENT_ANSWERS');
});

test('stage14 agent validates identity, data, time budgets and injected dependencies',async()=>{
  const agent=load(base+'agent/interview-voice.agent.ts',{
    'node:crypto':{randomUUID:()=> 'test-stage14'},
    '../../../core/errors.ts':{AgenticError},
    '../../../core/execution/runner.ts':{runAgentGraph:async options=>{
      assert.equal(options.identity.agentId,'interview-voice');
      assert.equal(options.identity.access.actorId,'owner');
      assert.ok(options.timeoutMs<=38000 && options.recursionLimit<=10);
      return options.createGraph(scope).invoke(options.input);
    }},'./state':state,'./graph':graph,'../tools/validation.tool':validation,
  });
  await assert.rejects(agent.runVoicePreparationAgent({actorId:'',input:preparation}),e=>e.code==='AGENT_INVALID_IDENTITY');
  await assert.rejects(agent.runVoicePreparationAgent({actorId:'owner',input:{...preparation,roomName:'bad'}}),
    e=>e.code==='AGENT_MODEL_INPUT_INVALID');
  const plan=await agent.runVoicePreparationAgent({actorId:'owner',input:preparation});
  assert.ok(plan.instructions.length>200);
  const report=await agent.runVoiceEvaluationAgent({actorId:'owner',input:evaluation,deps:{evaluateTranscript:async()=>draft}});
  assert.equal(report.overallScore,80);
});
