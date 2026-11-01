const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,base,validation,career,input,email,AgenticError,read}=require('./agentic-stage15-fixtures.cjs');
const Annotation=()=>undefined;Annotation.Root=x=>x;
const state=load(base+'agent/state.ts',{'@langchain/langgraph':{Annotation}});
const context=load(base+'nodes/context.node.ts',{'../tools/validation.tool':validation});
const draftPolicy=load('src/lib/career-os/application-packet-policy.ts',{
  'node:crypto':require('node:crypto'),'./contracts.ts':career['@/lib/career-os/contracts'],
});
const draft=load(base+'nodes/draft.node.ts',{'@/lib/career-os/application-packet-policy':draftPolicy});
const generate=load(base+'nodes/generate.node.ts',{'../../../core/errors.ts':{AgenticError}});
const verify=load(base+'nodes/verify.node.ts',{'../tools/validation.tool':validation});
const assemble=load(base+'nodes/assemble.node.ts',career);
let events=[];
class FakeStateGraph{
  constructor(){this.nodes=new Map();this.edges=new Map();}
  addNode(key,fn){this.nodes.set(key,fn);return this;}
  addEdge(a,b){this.edges.set(a,b);return this;}
  compile(){return {invoke:async input=>{let s={...input},node=this.edges.get('__start__');
    while(node && node!=='__end__'){if(!this.nodes.has(node))throw Error('missing node');s={...s,...await this.nodes.get(node)(s)};node=this.edges.get(node);}return s;}};}
}
const tracedNode=(scope,name,fn)=>s=>scope.step(name,()=>fn(s));
const graph=load(base+'agent/graph.ts',{
  '@langchain/langgraph':{StateGraph:FakeStateGraph,START:'__start__',END:'__end__'},
  '../../../core/nodes/traced-node.ts':{tracedNode},'./state':state,
  '../nodes/context.node':context,'../nodes/draft.node':draft,'../nodes/generate.node':generate,
  '../nodes/verify.node':verify,'../nodes/assemble.node':assemble,
});
const controller=new AbortController();
const scope={budget:{signal:controller.signal,assertActive(){}},step:async(name,fn)=>{events.push(name);return await fn();}};

test('stage15 draft graph performs four nodes and uses original conservative packet policy',async()=>{
  events=[];
  const s=await graph.createApplicationPacketGraph(scope).invoke({input});
  assert.deepEqual(events,['application.packet.context','application.packet.draft','application.packet.verify','application.packet.assemble']);
  assert.equal(s.result.subject,draftPolicy.draftApplicationEmail({language:'en',title:input.jobTitle,company:input.company,name:input.signer}).subject);
  assert.match(s.result.body,/Dear Hiring Team/);
});

test('stage15 suggestion graph checks evidence before exposing draft, never writes',async()=>{
  events=[];let called=0;
  const deps={generateEmail:async(_input,signal)=>{called++;assert.equal(signal.aborted,false);return email;},
    verifyFacts:()=>{called++;}};
  const s=await graph.createApplicationSuggestionGraph(scope,deps).invoke({input});
  assert.deepEqual(events,['application.suggestion.context','application.suggestion.generate','application.suggestion.verify','application.suggestion.assemble']);
  assert.equal(s.verified,true);assert.equal(s.result.subject,email.subject);assert.equal(called,2);
});

test('stage15 invalid model output stays unavailable, not shown',async()=>{
  const s=await graph.createApplicationSuggestionGraph(scope,{
    generateEmail:async()=>({...email,body:'Please find attached my CV'}),verifyFacts:()=>{},
  }).invoke({input});
  assert.equal(s.verified,false);assert.equal(s.result,null);
  const bad=await graph.createApplicationSuggestionGraph(scope,{
    generateEmail:async()=>email,verifyFacts:()=>{throw Error('invented achievements')},
  }).invoke({input});
  assert.equal(bad.result,null);
});

test('stage15 failed model and quota preserve safe error codes',async()=>{
  await assert.rejects(graph.createApplicationSuggestionGraph(scope,{
    generateEmail:async()=>{throw Error('provider secrets leaked in exception')},verifyFacts:()=>{},
  }).invoke({input}),e=>e.code==='AGENT_MODEL_UNAVAILABLE'&&!e.message.includes('secrets'));
  await assert.rejects(graph.createApplicationSuggestionGraph(scope,{
    generateEmail:async()=>{throw Object.assign(Error('quota'),{status:429})},verifyFacts:()=>{},
  }).invoke({input}),e=>e.code==='AGENT_MODEL_QUOTA_DENIED');
});

test('stage15 agent entrypoints bind authenticated caller and enforce bounded budgets',async()=>{
  const mockRun=async opts=>{
    assert.equal(opts.identity.agentId,'application');assert.equal(opts.identity.access.actorId,'owner');
    assert.ok(opts.timeoutMs<=50000);assert.equal(opts.recursionLimit,10);
    const output=await opts.createGraph(scope).invoke(opts.input);
    return output;
  };
  const agent=load(base+'agent/application.agent.ts',{
    'node:crypto':{randomUUID:()=>'stage15'}, '../../../core/errors.ts':{AgenticError},
    '../../../core/execution/runner.ts':{runAgentGraph:mockRun},...career,
    './state':state,'./graph':graph,'../tools/validation.tool':validation,
  });
  const assembled=await agent.runApplicationPacketAgent({actorId:'owner',input});
  assert.match(assembled.subject,/Application/);
  const suggestion=await agent.runApplicationSuggestionAgent({actorId:'owner',input,
    deps:{generateEmail:async()=>email,verifyFacts:()=>{}}});
  assert.equal(suggestion.subject,email.subject);
  await assert.rejects(agent.runApplicationPacketAgent({actorId:'',input}),e=>e.code==='UNAUTHORIZED');
  await assert.rejects(agent.runApplicationSuggestionAgent({actorId:'owner',input,
    deps:{generateEmail:async()=>null,verifyFacts:()=>{}}}),e=>e.code==='SUGGESTION_REQUIRES_REVIEW');
});

test('stage15 graph uses no persistent checkpointer, task state is ephemeral',()=>{
  assert.doesNotMatch(read(base+'agent/graph.ts'),/checkpointer|interrupt\(/i);
  assert.doesNotMatch(read(base+'agent/application.agent.ts'),/db\.|prisma|fetch\(|sendMail|sendEmail/);
});
