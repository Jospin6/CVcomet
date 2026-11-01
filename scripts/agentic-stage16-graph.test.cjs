const {test}=require('node:test');
const assert=require('node:assert/strict');
const {base,load,routing,contracts,engine,career,input,AgenticError}=require('./agentic-stage16-fixtures.cjs');
const Annotation=()=>undefined;Annotation.Root=x=>x;
const state=load(base+'agent/state.ts',{'@langchain/langgraph':{Annotation}});
const tools={'../tools/routing.tool':routing,'../tools/contracts.tool':contracts};
const nodes={
  context:load(base+'nodes/context.node.ts',tools),
  route:load(base+'nodes/route.node.ts',tools),
  delegate:load(base+'nodes/delegate.node.ts'),
  respond:load(base+'nodes/respond.node.ts'),
  verify:load(base+'nodes/verify.node.ts',{'@/lib/career-os/contracts':career,'@/lib/career-os/agent-engine':engine,
    '@/lib/quality/agent-quality-policy':{reviewCareerAgentAnswer:text=>{
      if(/I have submitted your application/i.test(text))throw new career.CareerContractError(502,'AGENT_UNSUPPORTED_ACTION_CLAIM');
      return text;
    }}}),
  assemble:load(base+'nodes/assemble.node.ts',{'@/lib/career-os/contracts':career}),
};
class FakeStateGraph{
  constructor(){this.nodes=new Map();this.edges=new Map();this.conditionals=new Map();}
  addNode(name,fn){this.nodes.set(name,fn);return this;}
  addEdge(a,b){this.edges.set(a,b);return this;}
  addConditionalEdges(from,fn){this.conditionals.set(from,fn);return this;}
  compile(){return {invoke:async input=>{
    let current={...input},node=this.edges.get('__start__'),count=0;
    while(node&&node!=='__end__'){
      if(++count>12)throw Error('unbounded supervisor graph');
      const fn=this.nodes.get(node);if(!fn)throw Error('missing delegate '+node);
      Object.assign(current,await fn(current));
      node=this.conditionals.has(node)?this.conditionals.get(node)(current):this.edges.get(node);
    }
    return current;
  }};}
}
const graph=load(base+'agent/graph.ts',{
  '@langchain/langgraph':{StateGraph:FakeStateGraph,START:'__start__',END:'__end__'},
  '../../../core/nodes/traced-node.ts':{tracedNode:(scope,name,fn)=>s=>scope.step(name,()=>fn(s))},
  './state':state,'../tools/contracts.tool':contracts,
  '../nodes/context.node':nodes.context,'../nodes/route.node':nodes.route,
  '../nodes/delegate.node':nodes.delegate,'../nodes/respond.node':nodes.respond,
  '../nodes/verify.node':nodes.verify,'../nodes/assemble.node':nodes.assemble,
});
const seen=[];
const scope={budget:{signal:new AbortController().signal,assertActive(){}},step:async(name,fn)=>{seen.push(name);return fn();}};
const depsFor=(specialist,answer='You can review this in your workspace.')=>({
  selectPlan:async()=>({specialist,calls:specialist==='general'?[]:[{tool:routing.SPECIALIST_READS[specialist][0],input:({get_my_job_match_insights:{matchId:'11111111-1111-4111-8111-111111111111'},get_my_resume:{resumeId:'11111111-1111-4111-8111-111111111111'},get_my_application:{applicationId:'11111111-1111-4111-8111-111111111111'}})[routing.SPECIALIST_READS[specialist][0]]||{}}]}),
  readSelected:async calls=>({reads:calls.map(c=>({tool:c.tool,source:'self_reported',result:{id:'owned'},truncated:false})),
    steps:calls.map(c=>({tool:c.tool,status:'completed'}))}),
  respond:async()=>answer,
});

test('stage16 true conditional StateGraph dispatches resume specialist and verifies response',async()=>{
  seen.length=0;
  const result=await graph.createSupervisorGraph(scope,depsFor('resume')).invoke({input});
  assert.equal(result.verified,true);assert.equal(result.result.specialist,'resume');
  assert.equal(result.result.requiresApproval,false);
  assert.equal(result.result.steps[0].tool,'list_my_resumes');
  assert.deepEqual(seen,['supervisor.context','supervisor.route','supervisor.delegate.resume',
    'supervisor.respond','supervisor.verify','supervisor.assemble']);
});

test('stage16 all specialists take exclusive branch and no parallel tool dispatch',async()=>{
  for(const specialist of contracts.SUPERVISOR_SPECIALISTS){
    seen.length=0;
    const result=await graph.createSupervisorGraph(scope,depsFor(specialist)).invoke({input});
    assert.equal(result.result.specialist,specialist);
    assert.equal(seen.filter(s=>s.startsWith('supervisor.delegate.')).length,1);
    assert.equal(seen[2],`supervisor.delegate.${specialist}`);
  }
});

test('stage16 rejects injected write tool before any read or answer',async()=>{
  let called=0;
  await assert.rejects(graph.createSupervisorGraph(scope,{
    selectPlan:async()=>({specialist:'resume',calls:[{tool:'submit_application',input:{}}]}),
    readSelected:async()=>{called++;return {reads:[],steps:[]}},
    respond:async()=>{called++;return 'never'},
  }).invoke({input}),e=>e.code==='AGENT_PLAN_REJECTED');
  assert.equal(called,0);
});

test('stage16 false claim never reaches the public result',async()=>{
  await assert.rejects(graph.createSupervisorGraph(scope,depsFor('general','I have submitted your application.')).invoke({input}),
    e=>e.code==='AGENT_UNSUPPORTED_ACTION_CLAIM');
});

test('stage16 no partial answer when provider fails, no fabricated fallback',async()=>{
  await assert.rejects(graph.createSupervisorGraph(scope,{
    selectPlan:async()=>({specialist:'general',calls:[]}),
    readSelected:async()=>({reads:[],steps:[]}),respond:async()=>{throw Error('provider down')},
  }).invoke({input}),/provider down/);
});

test('stage16 entrypoint binds authenticated identity, budget and does not expose internal state',async()=>{
  const agent=load(base+'agent/supervisor.agent.ts',{
    'node:crypto':{randomUUID:()=> 'stage16'},'../../../core/errors.ts':{AgenticError},
    '@/lib/career-os/contracts':career,'../../../core/execution/runner.ts':{
      runAgentGraph:async options=>{
        assert.equal(options.identity.agentId,'supervisor');
        assert.equal(options.identity.access.actorId,'owner');
        assert.equal(options.timeoutMs,55000);assert.ok(options.recursionLimit<=16);
        return options.createGraph(scope).invoke(options.input);
      }},
    './state':state,'./graph':graph,'../tools/routing.tool':routing,
  });
  const result=await agent.runCareerSupervisorAgent({input,deps:depsFor('general')});
  assert.deepEqual(Object.keys(result).sort(),['message','mode','requiresApproval','specialist','steps']);
  await assert.rejects(agent.runCareerSupervisorAgent({input:{...input,actorId:''},deps:depsFor('general')}),e=>e.code==='UNAUTHORIZED');
});

test('stage16 preserves vetted quota errors through safe graph error normalization',async()=>{
  const agent=load(base+'agent/supervisor.agent.ts',{
    'node:crypto':{randomUUID:()=> 'stage16'},'../../../core/errors.ts':{AgenticError},
    '@/lib/career-os/contracts':career,
    '../../../core/execution/runner.ts':{runAgentGraph:async opts=>{
      try{return await opts.createGraph(scope).invoke(opts.input)}
      catch{throw new AgenticError('AGENT_RUN_FAILED')}
    }},
    './state':state,'./graph':graph,'../tools/routing.tool':routing,
  });
  const baseline=depsFor('general');
  await assert.rejects(agent.runCareerSupervisorAgent({input,deps:{...baseline,
    selectPlan:async()=>{throw {code:'AI_MONTHLY_LIMIT',status:429}}
  }}),e=>e.code==='AI_MONTHLY_LIMIT'&&e.status===429);
  await assert.rejects(agent.runCareerSupervisorAgent({input,deps:{...baseline,
    selectPlan:async()=>{throw Error('secret provider exception')}
  }}),e=>e.code==='AGENT_FAILED'&&e.status===502&&!e.message.includes('secret'));
});

test('stage16 preserves vetted ownership failures but never leaks private data',async()=>{
  const agent=load(base+'agent/supervisor.agent.ts',{
    'node:crypto':{randomUUID:()=> 'stage16'},'../../../core/errors.ts':{AgenticError},
    '@/lib/career-os/contracts':career,
    '../../../core/execution/runner.ts':{runAgentGraph:async opts=>{
      try{return await opts.createGraph(scope).invoke(opts.input)}
      catch{throw new AgenticError('AGENT_RUN_FAILED')}
    }},
    './state':state,'./graph':graph,'../tools/routing.tool':routing,
  });
  await assert.rejects(agent.runCareerSupervisorAgent({input,deps:{
    selectPlan:async()=>({specialist:'resume',calls:[{tool:'list_my_resumes',input:{}}]}),
    readSelected:async()=>{throw new career.CareerContractError(404,'RESOURCE_NOT_FOUND')},
    respond:async()=>{throw Error('must never be called')},
  }}),e=>e.code==='RESOURCE_NOT_FOUND'&&e.status===404);
});
