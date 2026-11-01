const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const base='src/lib/agentic/agents/interview-text/';
function load(file,imports={}){
 const src=fs.readFileSync(path.join(root,file),'utf8');
 const js=ts.transpileModule(src,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 vm.runInNewContext(`(function(require,module,exports){${js}\n})`,{console,AbortController,AbortSignal,Date,Promise,Map,Set,Error})((id)=>{
  if(Object.hasOwn(imports,id))return imports[id];throw Error(`Unexpected dependency ${id} in ${file}`);
 },module,module.exports);
 return module.exports;
}
const policy=load('src/lib/career/interview-coach-policy.ts');
class AgenticError extends Error {constructor(code,status=500){super(code);this.code=code;this.status=status}}
const errors={'../../../core/errors.ts':{AgenticError}};
const validation=load(base+'tools/validation.tool.ts',{...errors,'@/lib/career/interview-coach-policy':policy});
const Annotation=()=>undefined;Annotation.Root=x=>x;
const state=load(base+'agent/state.ts',{'@langchain/langgraph':{Annotation}});
const ctx=load(base+'nodes/context.node.ts',{'../tools/validation.tool':validation});
const gen=load(base+'nodes/generate.node.ts',errors);
const verify=load(base+'nodes/verify.node.ts',{'../tools/validation.tool':validation});
const assemble=load(base+'nodes/assemble.node.ts',errors);
const events=[];
class FakeStateGraph {
 constructor(){this.nodes=new Map();this.edges=new Map()}
 addNode(name,fn){this.nodes.set(name,fn);return this}
 addEdge(from,to){this.edges.set(from,to);return this}
 compile(){const self=this;return {async invoke(input){let node=self.edges.get('__start__'),current={...input};let n=0;
 while(node && node!=='__end__') {if(++n>10)throw Error('unbounded graph');current={...current,...await self.nodes.get(node)(current)};node=self.edges.get(node)}return current;}}}
}
const tracedNode=(scope,name,fn)=>s=>scope.step(name,()=>fn(s));
const graph=load(base+'agent/graph.ts',{
  '@langchain/langgraph':{StateGraph:FakeStateGraph,START:'__start__',END:'__end__'},
  '../../../core/nodes/traced-node.ts':{tracedNode},'./state':state,
  '../nodes/context.node':ctx,'../nodes/generate.node':gen,'../nodes/verify.node':verify,'../nodes/assemble.node':assemble,
});
const scope={budget:{signal:new AbortController().signal,assertActive(){}},step:async(name,fn)=>{events.push(name);return await fn();}};
const prep={role:'Engineer',level:'Mid',language:'en',questionCount:5,jobDescription:'Responsibilities',resumeContext:'',profile:'{}',factsFromProfile:[]};
const evalInput={role:'Engineer',language:'en',question:'Tell me about a problem you solved.',answer:'I solved a customer incident by checking logs.'};
const goodDraft={relevance:4,specificity:3,structure:3,clarity:4,strength:'Clear answer',improvement:'Explain results',nextExercise:'Rehearse STAR',evidenceQuote:'checking logs'};

test('stage13 mock graph executes four distinct preparation nodes in correct order',async()=>{
 events.length=0;let called=0;
 const result=await graph.createInterviewPreparationGraph(scope,{generateQuestions:async(input,signal)=>{
   assert.equal(input.role,'Engineer');assert.equal(signal.aborted,false);called++;return {questions:[
   {question:'Describe an architecture decision you made.',suggestedAnswer:'Explain trade-offs.',focus:'architecture'},
   ],recruiterQuestions:[]};
 }}).invoke({input:prep});
 assert.deepEqual(events,['interview-text.prepare.context','interview-text.prepare.generate',
  'interview-text.prepare.verify','interview-text.prepare.assemble']);
 assert.equal(called,1);assert.equal(result.result.questions.length,5);assert.equal(result.result.source,'model');
});

test('stage13 mock graph continues with static fallback on model downtime',async()=>{
 const result=await graph.createInterviewPreparationGraph(scope,{generateQuestions:async()=>{throw Error('AI offline')}}).invoke({input:prep});
 assert.equal(result.result.source,'fallback');assert.equal(result.result.questions.length,5);
});

test('stage13 mock graph must never swallow preparation quota rejection',async()=>{
 const error=Object.assign(new Error('quota'),{status:429});
 await assert.rejects(graph.createInterviewPreparationGraph(scope,{generateQuestions:async()=>{throw error}}).invoke({input:prep}),
  e=>e.status===429);
});

test('stage13 mock graph evaluates with deterministic score and quoted evidence',async()=>{
 events.length=0;
 const state=await graph.createInterviewEvaluationGraph(scope,{evaluateAnswer:async(input)=>{
   assert.equal(input.question,evalInput.question);return goodDraft;
 }}).invoke({input:evalInput});
 assert.deepEqual(events,['interview-text.evaluate.context','interview-text.evaluate.generate',
  'interview-text.evaluate.verify','interview-text.evaluate.assemble']);
 assert.equal(state.result.feedback.status,'evaluated');assert.equal(state.result.feedback.evidenceQuote,'checking logs');
 assert.equal(state.result.feedback.score,89);
});

test('stage13 mock graph models failures as ungraded feedback, not heuristics',async()=>{
 const result=await graph.createInterviewEvaluationGraph(scope,{evaluateAnswer:async()=>{throw Error('timeout')}}).invoke({input:evalInput});
 assert.equal(result.result.feedback.score,null);assert.equal(result.result.feedback.status,'unavailable');
});

test('stage13 public agent entrypoints reject missing identity & invalid inputs and limit recursion',async()=>{
 const agent=load(base+'agent/interview-text.agent.ts',{
  'node:crypto':{randomUUID:()=> 'run13'},...errors,
  '../../../core/execution/runner.ts':{runAgentGraph:async opts=>{
    assert.equal(opts.identity.agentId,'interview-text');assert.equal(opts.identity.access.actorId,'owned');
    assert.ok(opts.recursionLimit<=12);assert.ok(opts.timeoutMs<=48000);
    return opts.createGraph(scope).invoke(opts.input);
  }},'./state':state,'./graph':graph,'../tools/validation.tool':validation,
 });
 await assert.rejects(agent.runInterviewPreparationAgent({actorId:'',input:prep,deps:{}}),{code:'AGENT_INVALID_IDENTITY'});
 await assert.rejects(agent.runInterviewEvaluationAgent({actorId:'owned',input:{...evalInput,answer:'x'},deps:{}}),{code:'AGENT_MODEL_INPUT_INVALID'});
 const result=await agent.runInterviewPreparationAgent({actorId:'owned',input:prep,deps:{}});
 assert.equal(result.source,'fallback');assert.equal(result.questions.length,5);
 const assessment=await agent.runInterviewEvaluationAgent({actorId:'owned',input:evalInput,deps:{}});
 assert.equal(assessment.feedback.score,null);
});
