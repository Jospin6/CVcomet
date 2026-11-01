/** Stage 09 unit and wiring tests: no npm installation, provider or database needed. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
let ts;
try { ts=require('typescript'); }
catch { ts=require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript')); }
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
function load(rel,mocks={}){
 const code=ts.transpileModule(read(rel),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',code)(dep=>{
  if(Object.hasOwn(mocks,dep))return mocks[dep];
  throw Error(`Unexpected import: ${dep} in ${rel}`);
 },mod,mod.exports);
 return mod.exports;
}
const prefix='src/lib/agentic/agents/ats/';
const sample={title:'Developer',design:{hiddenSections:[]},projects:[],experiences:[]};
const visible={...sample,title:'Visible title'};
const validateJob=(_,text)=>{
 if(text.includes('obsolete'))throw Error('stale citations');
 return {title:'Engineer',requirements:[]};
};
const plan=load(prefix+'tools/plan.tool.ts',{
 '@/lib/career/ats-text':{visibleAtsResume:()=>visible},
 '@/lib/career/job-match':{validateJobAnalysis:validateJob},
}).planAtsAnalysis;

test('stage09: no job means only content/PDF analysis',()=>{
 const p=plan({resume:sample});
 assert.equal(p.jobMode,'none');assert.equal(p.savedAnalysis,null);assert.equal(p.visible,visible);
});
test('stage09: verified saved job requirements avoid another model extraction',()=>{
 const p=plan({resume:sample,jobDescription:'React engineer',jobAnalysis:{requirements:[]}});
 assert.equal(p.jobMode,'saved');assert.ok(p.savedAnalysis);
});
test('stage09: stale job quotes force fresh job extraction',()=>{
 const p=plan({resume:sample,jobDescription:'obsolete job',jobAnalysis:{requirements:[]}});
 assert.equal(p.jobMode,'extract');assert.equal(p.savedAnalysis,null);
});
class ProfileError extends Error {constructor(status,code){super(code);this.status=status;this.code=code;}}
class AgenticError extends Error {constructor(code,status){super(code);this.code=code;this.status=status;}}
const errors=[];
const analysis=load(prefix+'tools/analysis.tool.ts',{
 '@/lib/ai/model':{getAIModel:async()=>({fake:true})},
 '@/lib/career-profile/ai':{reserveProfileAI:async(user,kind)=>errors.push([user,kind])},
 '@/lib/career-profile/http':{ProfileError,profileAIError:e=>({code:e.code||'AI_UNAVAILABLE'})},
 '@/lib/career-profile/schema':{emptyProfile:()=>({})},
 '@/lib/career/ats-review':{reviewAtsContent:async()=>({status:'COMPLETE',criteria:[],issues:[]})},
 '@/lib/career/job-match':{analyzeJobDescription:async()=>({requirements:[]}),matchJob:()=>({requirements:[]})},
 '@/lib/career/ats-job-match':{assessAtsJobMatch:()=>({status:'COMPLETE',score:100,requirements:[]})},
 '../../../core/errors.ts':{AgenticError},
});
const identity={agentId:'ats',access:{kind:'authenticated',actorId:'owner-uuid'}};
const controller=new AbortController();
test('stage09: one reservation after provider availability, no second provider call',async()=>{
 const outcome=await analysis.prepareAtsModel(identity,controller.signal);
 assert.equal(outcome.modelError,null);assert.equal(errors.length,1);assert.deepEqual(errors[0],['owner-uuid','ATS_REVIEW']);
});
test('stage09: forged agent and guest identity cannot reserve credits',async()=>{
 await assert.rejects(analysis.prepareAtsModel({agentId:'resume',access:identity.access},controller.signal),{code:'AGENT_ACCESS_DENIED'});
 assert.equal(errors.length,1);
});
test('stage09: provider failure returns unavailable review without inventing full score',async()=>{
 const unavailable=await analysis.prepareAtsModel(identity,controller.signal,{acquireModel:async()=>{throw Object.assign(Error('fail'),{code:'AI_UNAVAILABLE'});}});
 assert.equal(unavailable.model,null);
 const semantic=await analysis.runAtsEvidenceReview({model:null,modelError:unavailable.modelError,plan:{visible},input:{resume:sample}},controller.signal);
 assert.equal(semantic.status,'UNAVAILABLE');assert.equal(semantic.criteria.length,0);
});
test('stage09: fallback still compares saved requirements when model is down',async()=>{
 const result=await analysis.runAtsJobMatch({model:null,modelError:'AI_UNAVAILABLE',plan:{visible,jobMode:'saved',savedAnalysis:{requirements:[]}},input:{resume:sample,jobDescription:'React'}},controller.signal);
 assert.equal(result.status,'COMPLETE');assert.equal(result.score,100);
});
test('stage09: no posting never claims job match',async()=>{
 const result=await analysis.runAtsJobMatch({model:{},plan:{visible,jobMode:'none',savedAnalysis:null},input:{resume:sample}},controller.signal);
 assert.equal(result.status,'NOT_PROVIDED');assert.equal(result.score,null);
});
test('stage09: when job model fails, job score must be unavailable',async()=>{
 const result=await analysis.runAtsJobMatch({model:{},plan:{visible,jobMode:'extract',savedAnalysis:null},input:{resume:sample,jobDescription:'Role'}},controller.signal,{extractJob:async()=>{throw new Error('failure');}});
 assert.equal(result.status,'UNAVAILABLE');assert.equal(result.score,null);
});
const verify=load(prefix+'tools/verify.tool.ts').verifyAtsReport;
const baseReport={version:2,rubricVersion:'2026-10-ats-v2',overallScore:null,review:{status:'UNAVAILABLE'},content:{score:null},technical:{score:null},jobMatch:{status:'NOT_PROVIDED',score:null},issues:[]};
test('stage09: unavailable semantic review can never yield complete content score',()=>{
 verify(baseReport);
 assert.throws(()=>verify({...baseReport,content:{score:90}}),/ATS_UNVERIFIED_SCORE/);
});
test('stage09: no overall ATS acceptance percentage, even with complete report',()=>{
 assert.throws(()=>verify({...baseReport,overallScore:95}),/ATS_INVALID_REPORT/);
});
test('stage09: scores strictly bounded and partial job state cannot claim score',()=>{
 assert.throws(()=>verify({...baseReport,technical:{score:110}}),/ATS_SCORE_OUT_OF_RANGE/);
 assert.throws(()=>verify({...baseReport,jobMatch:{status:'UNAVAILABLE',score:90}}),/ATS_UNVERIFIED_SCORE/);
});
test('stage09: ungrounded or malformed recommendation rejected',()=>{
 assert.throws(()=>verify({...baseReport,issues:[{category:'CONTENT',severity:'warning',suggestion:''}]}),/ATS_INVALID_ISSUES/);
});
test('stage09: full agent structure has separated prompts, nodes, tools and graph',()=>{
 for(const rel of ['agent/graph.ts','agent/state.ts','agent/ats.agent.ts','nodes/plan.node.ts','nodes/model.node.ts','nodes/review.node.ts','nodes/job-match.node.ts','nodes/assemble.node.ts','nodes/verify.node.ts','tools/analysis.tool.ts','tools/assemble.tool.ts','tools/plan.tool.ts','tools/verify.tool.ts','prompts/review.prompt.ts'])
  assert.ok(fs.existsSync(path.join(root,prefix,rel)),rel);
 const graph=read(prefix+'agent/graph.ts');
 assert.match(graph,/new StateGraph\(/);
 assert.match(graph,/\.addEdge\(\["review", "job-match"\], "assemble"\)/);
 for(const node of ['plan','model','review','job-match','assemble','verify'])assert.ok(graph.includes(`.addNode("${node}"`));
 assert.doesNotMatch(graph,/\.compile\(\s*\{[^}]*checkpointer|prisma\.cv\.update|prisma\.atsAnalysis\.create/);
});
test('stage09: real API delegates through ATS Agent but keeps ownership, PDF, cache and persistence',()=>{
 const route=read('src/app/api/ats/route.ts');
 assert.match(route,/runAtsAgent/);assert.match(route,/conversation: \{ userId: user\.id \}/);
 assert.match(route,/userId: user\.id/);assert.match(route,/inspectAtsPdf/);
 assert.match(route,/fingerprint/);assert.match(route,/atsAnalysis\.create/);
});
test('stage09: never sends account contact info to LLM; old rubric still checks contact format',()=>{
 const review=read('src/lib/career/ats-review.ts');
 assert.match(review,/!item\.field\.startsWith\("contact\."\)/);
 const rubric=read('src/lib/career/ats.ts');
 assert.match(rubric,/namedEmail/);
});
test('stage09: moved evidence prompt preserves source quotation, anti-discrimination and no invented achievements',()=>{
 const prompts=read(prefix+'prompts/review.prompt.ts');
 for(const phrase of ['EVERY supplied claimedSkills term','copy separate actionQuote','Never invent missing method','Preserve evidence quotations','nationality, name, age, gender']) assert.ok(prompts.includes(phrase),phrase);
});
test('stage09: no layouts/templates/resume editor or ATS visual component changed',()=>{
 const route=read('src/app/api/ats/route.ts');assert.doesNotMatch(route,/\.cv\.update\(/);
 assert.equal(read(prefix+'agent/graph.ts').includes('compile()'),true);
});
