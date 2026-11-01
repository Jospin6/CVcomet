/** Mandatory real StateGraph integration; no external API calls or DB writes.
 * Requires npm install and prisma generate; failures are NOT silently skipped. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { register } from 'node:module';
register(new URL('./agentic-stage06-loader.mjs',import.meta.url));

async function runtime() {
  try {
    const [agent,resume] = await Promise.all([
      import('../src/lib/agentic/agents/ats/agent/ats.agent.ts'),
      import('../src/lib/resume-editor.ts'),
    ]);
    const document=resume.resumeContentSchema.parse({
      title:'Frontend Engineer',contact:{name:'Alex Doe',email:'alex@example.test'},
      summary:['Builds accessible web applications.'],
      experiences:[{title:'Engineer',company:'Example Studio',start:'2022',end:'Present',description:['Built an accessible React dashboard for support staff, using TypeScript and unit testing to improve keyboard navigation.']}],
      skills:[{hardskills:'React, TypeScript',tools:'Git'}],
    });
    return {run:agent.runAtsAgent,document};
  } catch(error) {
    if(error?.code==='ERR_MODULE_NOT_FOUND'||error?.code==='MODULE_NOT_FOUND')
      assert.fail('Install npm dependencies and run prisma generate; stage09 real LangGraph tests are mandatory.');
    throw error;
  }
}
const resultReview=(document)=>({
  status:'COMPLETE',
  criteria:['specificity','positioning','writing'].map(id=>({id,rating:0,reason:'Not assessed by the synthetic test fixture',evidence:[]})),
  contributions:[],skillEvidence:[],issues:[],
});
function deps(overrides={}) {
  const calls={provider:0,review:0,job:0};
  return {calls,deps:{
    acquireModel:async()=>{calls.provider++;return {mock:true};},
    review:async(doc,lang)=>{calls.review++;assert.equal(lang,'en');return resultReview(doc);},
    extractJob:async()=>{calls.job++;return {title:'Engineer',company:'',location:'',workMode:'',contractType:'',seniority:'',summary:'',objective:'',responsibilities:[],requiredSkills:[],preferredSkills:[],technologies:[],education:[],experience:[],keywords:[],warnings:[],requirements:[{id:'react',title:'React',category:'TECHNICAL',priority:'REQUIRED',description:'',evidence:'React is required',ambiguity:'',terms:['React']}]};},
    ...overrides,
  }};
}
test('stage09 REAL graph: no job => semantic and deterministic checks, no invented ATS prediction',async()=>{
 const {run,document}=await runtime();const mock=deps();
 const report=await run({actorId:randomUUID(),input:{resume:document,language:'en'},deps:mock.deps});
 assert.equal(mock.calls.provider,1);assert.equal(mock.calls.review,1);assert.equal(mock.calls.job,0);
 assert.equal(report.version,2);assert.equal(report.overallScore,null);
 assert.equal(report.review.status,'COMPLETE');assert.equal(report.jobMatch.status,'NOT_PROVIDED');
 assert.ok(report.issues.every(x=>x.suggestion.length>0));
});
test('stage09 REAL graph: model unavailable still returns partial honest report',async()=>{
 const {run,document}=await runtime();
 const report=await run({actorId:randomUUID(),input:{resume:document},deps:{acquireModel:async()=>{throw Error('offline');}}});
 assert.equal(report.review.status,'UNAVAILABLE');assert.equal(report.content.score,null);
 assert.equal(report.jobMatch.status,'NOT_PROVIDED');assert.equal(report.overallScore,null);
});
test('stage09 REAL graph: job branch and reviewer both run, job comparison is independent',async()=>{
 const {run,document}=await runtime();const mock=deps();
 const report=await run({actorId:randomUUID(),input:{resume:document,jobDescription:'Frontend Engineer needed. React is required, TypeScript is preferred.'},deps:mock.deps});
 assert.equal(mock.calls.provider,1);assert.equal(mock.calls.review,1);assert.equal(mock.calls.job,1);
 assert.equal(report.jobMatch.status,'COMPLETE');assert.equal(report.review.status,'COMPLETE');
 assert.equal('proposalId' in report,false);
});
test('stage09 REAL graph: actor identity is required before any model call',async()=>{
 const {run,document}=await runtime(); const mock=deps();
 await assert.rejects(run({actorId:'',input:{resume:document},deps:mock.deps}),e=>e.code==='AGENT_INVALID_IDENTITY');
 assert.equal(mock.calls.provider,0);
});
test('stage09 REAL graph: cancellation before invocation prevents provider call',async()=>{
 const {run,document}=await runtime();const mock=deps();const ctrl=new AbortController();ctrl.abort();
 await assert.rejects(run({actorId:randomUUID(),input:{resume:document},deps:mock.deps,signal:ctrl.signal}));
 assert.equal(mock.calls.provider,0);
});
