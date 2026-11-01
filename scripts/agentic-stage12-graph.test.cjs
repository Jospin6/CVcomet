const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const base='src/lib/agentic/agents/career-map/';
const load=(relative,imports={})=>{
 const s=fs.readFileSync(path.join(root,relative),'utf8');
 const c=ts.transpileModule(s,{fileName:relative,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const m={exports:{}};
 vm.runInNewContext(`(function(require,module,exports){${c}\n})`,{console,AbortController,AbortSignal,Date,Promise,Map,Set,WeakSet})(
   key=>{if(Object.hasOwn(imports,key))return imports[key];throw Error('missing '+key+' for '+relative)},m,m.exports);
 return m.exports;
};
const catalog=load(base+'tools/catalog.tool.ts');
const evidence=load(base+'tools/evidence.tool.ts');
const rank=load(base+'tools/rank.tool.ts',{'./catalog.tool':catalog,'./evidence.tool':evidence});
const roadmap=load(base+'tools/roadmap.tool.ts',{'./catalog.tool':catalog});
const verify=load(base+'tools/verify.tool.ts',{'./catalog.tool':catalog});
const Annotation=()=>undefined;Annotation.Root=x=>x;
const state=load(base+'agent/state.ts',{'@langchain/langgraph':{Annotation}});
const nodes={
 context:load(base+'nodes/context.node.ts'),
 evidence:load(base+'nodes/evidence.node.ts',{'../tools/evidence.tool':evidence}),
 rank:load(base+'nodes/rank.node.ts',{'../tools/rank.tool':rank}),
 roadmap:load(base+'nodes/roadmap.node.ts',{'../tools/roadmap.tool':roadmap}),
 verify:load(base+'nodes/verify.node.ts',{'../tools/verify.tool':verify}),
 assemble:load(base+'nodes/assemble.node.ts'),
};
const events=[];
class FakeStateGraph {
 constructor(){this.nodes=new Map();this.edges=new Map();}
 addNode(name,fn){this.nodes.set(name,fn);return this;}
 addEdge(a,b){this.edges.set(a,b);return this;}
 compile(){const self=this;return {async invoke(input){
   let node=self.edges.get('__start__');let state={...input};let hop=0;
   while(node && node!=='__end__'){
     if(++hop>10)throw Error('Graph did not terminate');
     state={...state,...await self.nodes.get(node)(state)};
     node=self.edges.get(node);
   }
   return state;
 }};}
}
const tracedNode=(scope,name,fn)=>x=>scope.step(name,()=>fn(x));
const graph=load(base+'agent/graph.ts',{
 '@langchain/langgraph':{START:'__start__',END:'__end__',StateGraph:FakeStateGraph},
 '../../../core/nodes/traced-node.ts':{tracedNode},'./state':state,
 '../nodes/context.node':nodes.context,'../nodes/evidence.node':nodes.evidence,
 '../nodes/rank.node':nodes.rank,'../nodes/roadmap.node':nodes.roadmap,
 '../nodes/verify.node':nodes.verify,'../nodes/assemble.node':nodes.assemble,
});
const preferences={targetRoles:['Backend Engineer'],interests:[],workMode:'ANY',goal:'EXPLORATION',
 balance:'BALANCED',identity:'SPECIALIST',income:'COMFORTABLE',qualities:[],positions:5};
const profile={name:'Candidate',headline:'Professional',experienceLevel:'PROFESSIONAL',skills:'Node.js, SQL, TypeScript',
 experiences:[],projects:[],certifications:[]};
const input={input:{profile,cv:null,preferences}};

test('stage12 actual six nodes run in order through graph and output verified result',async()=>{
 events.length=0;
 const scope={step:async(name,fn)=>{events.push(name);return fn()}};
 const graphState=await graph.createCareerMapGraph(scope).invoke(input);
 assert.deepEqual(events,["career-map.context","career-map.evidence","career-map.rank",
   "career-map.roadmap","career-map.verify","career-map.assemble"]);
 assert.equal(graphState.verified,true);
 assert.equal(graphState.result.graph.nodes.length,5);
 assert.equal(graphState.result.snapshot.name,'Candidate');
 assert.ok(graphState.result.graph.nodes[0].id==='backend-engineer');
 assert.equal(graphState.result.graph.edges.length,5);
});

test('stage12 agent requires authenticated actor, verifies preference input and does not persist inside graph',async()=>{
 const runAgentGraph=async opts=>{
   assert.equal(opts.identity.agentId,'career-map');
   assert.equal(opts.identity.access.kind,'authenticated');
   assert.equal(opts.timeoutMs,12000);
   const scoped={step:(_name,fn)=>fn()};
   return opts.createGraph(scoped).invoke(opts.input);
 };
 const fakePrefs={safeParse:p=>({success:true,data:p})};
 const agent=load(base+'agent/career-map.agent.ts',{
  'node:crypto':{randomUUID:()=> 'run-test-id'},
  '../../../core/errors.ts':{AgenticError:class AgenticError extends Error{constructor(code){super(code);this.code=code}}},
  '../../../core/execution/runner.ts':{runAgentGraph},
  '../tools/preferences.tool':{preferenceSchema:fakePrefs},
  './state':state,'./graph':graph,
 });
 await assert.rejects(agent.runCareerMapAgent({actorId:'',input:input.input}),{code:'AGENT_INVALID_IDENTITY'});
 const result=await agent.runCareerMapAgent({actorId:'owner',input:input.input});
 assert.equal(result.graph.nodes.length,5);
 assert.equal(result.snapshot.skillSource,'profile');
});
