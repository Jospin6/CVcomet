/** Mandatory actual LangGraph integration. Requires npm install + prisma generate.
 * The injected provider/quota doubles never contact external services. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { register } from 'node:module';
register(new URL('./agentic-stage06-loader.mjs',import.meta.url));

async function runtime() {
 try {
  const [agent,editor] = await Promise.all([
   import('../src/lib/agentic/agents/resume/agent/resume.agent.ts'),
   import('../src/lib/resume-editor.ts'),
  ]);
  return {run:agent.runResumeAgent,document:editor.resumeContentSchema.parse({title:'Data Engineer',summary:['Built Python pipelines.']})};
 } catch (error) {
  if (error?.code==='ERR_MODULE_NOT_FOUND'||error?.code==='MODULE_NOT_FOUND')
    assert.fail('Install npm dependencies and run prisma generate; real LangGraph tests are required.');
  throw error;
 }
}
function applied(edits) {return {object:{status:'applied',message:'Proposal',summary:['Updated'],edits},document:null};}
function options(document,edits,extra={}) {
 let reserved=0,called=0;
 return {get reserved(){return reserved;},get called(){return called;},args:{
  actorId:randomUUID(),
  input:{document,instruction:'Improve my summary',language:'en',profileFacts:[],linkedJobAdvert:null,...extra},
  deps:{async reserveQuota(){reserved++;},async generate(){called++;return applied(edits);}},
 }};
}
test('stage07 REAL graph: plans, bills once, verifies & returns review-only proposal',async()=>{
 const {run,document}=await runtime();
 const data=options(document,[{type:'setField',path:'summary.0',value:'Built reliable Python pipelines.'}]);
 const result=await run(data.args);
 assert.equal(result.object.status,'applied');
 assert.equal(result.document.summary[0],'Built reliable Python pipelines.');
 assert.equal(data.reserved,1);assert.equal(data.called,1);
 assert.equal('proposalId' in result,false); // persisted only by existing proposal service
});
test('stage07 REAL graph: target field blocks unrelated edits',async()=>{
 const {run,document}=await runtime();
 const data=options(document,[{type:'setField',path:'title',value:'Fake title'},
   {type:'setField',path:'summary.0',value:'Built reliable Python pipelines.'}],{targetField:'summary.0'});
 const result=await run(data.args);
 assert.equal(result.object.edits.length,1);
 assert.equal(result.document.title,'Data Engineer');
});
test('stage07 REAL graph: missing job skips LLM and quota',async()=>{
 const {run,document}=await runtime();
 const data=options(document,[],{instruction:'Adapt my resume to this job posting'});
 const result=await run(data.args);
 assert.equal(result.object.status,'clarification');
 assert.equal(data.called,0);assert.equal(data.reserved,0);
});
test('stage07 REAL graph: unsupported numbers never become review proposals',async()=>{
 const {run,document}=await runtime();
 const data=options(document,[{type:'setField',path:'summary.0',value:'Built 99 Python pipelines.'}]);
 const result=await run(data.args);
 assert.equal(result.object.status,'clarification');assert.equal(result.document,null);
});
test('stage07 REAL graph: small field generation supports profile facts with no CV mutation',async()=>{
 const {runResumeFieldAgent}=await import('../src/lib/agentic/agents/resume/agent/field.agent.ts');
 let called=0;
 const result=await runResumeFieldAgent({actorId:randomUUID(),input:{
  action:'GENERATE',field:'summary.0',language:'en',systemPolicy:'Only verified facts.',
  facts:{skills:'Python'},candidateSources:['Built 4 data pipelines.'],
 },model:async(_id,request)=>{called++;assert.equal(request.feature,'RESUME_EDIT');return 'Built 4 data pipelines.';}});
 assert.equal(called,1);assert.equal(result.proposal,'Built 4 data pipelines.');
 assert.equal('document' in result,false);
});
test('stage07 REAL graph: generated metrics not sourced from profile are blocked',async()=>{
 const {runResumeFieldAgent}=await import('../src/lib/agentic/agents/resume/agent/field.agent.ts');
 const result=await runResumeFieldAgent({actorId:randomUUID(),input:{
  action:'GENERATE',field:'summary.0',language:'en',systemPolicy:'Only verified facts.',
  facts:{skills:'Python'},candidateSources:['Built data pipelines.'],
 },model:async()=> 'Built 900 data pipelines.'});
 assert.equal(result.issue,'UNSUPPORTED_FACTS');
 assert.equal(result.proposal,'');
});
