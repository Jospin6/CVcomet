/** Mandatory REAL LangGraph invocation, no DB/AI access. No skipped tests. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { register } from 'node:module';
register(new URL('./agentic-stage06-loader.mjs', import.meta.url));

async function runtime() {
  try {
    const [agent, schema, career, matcher] = await Promise.all([
      import('../src/lib/agentic/agents/job-match/agent/job-match.agent.ts'),
      import('../src/lib/career/job-schema.ts'),
      import('../src/lib/career-profile/schema.ts'),
      import('../src/lib/career/job-match.ts'),
    ]);
    return { run: agent.runJobMatchAgent, schema, career, matcher };
  } catch(error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' || error?.code === 'MODULE_NOT_FOUND')
      assert.fail('Install npm dependencies and run prisma generate: real LangGraph integration tests are mandatory.');
    throw error;
  }
}
const description = 'Frontend Engineer. React is required. TypeScript is required. Docker is preferred. Please build accessible interfaces and work closely with the team.';
const req = (id, evidence, priority = 'REQUIRED') => ({
  id, title:id, category:'TECHNICAL', priority, description:'', evidence, ambiguity:'', terms:[id],
});
const analysis = () => ({
  title:'Frontend Engineer', company:'', location:'', workMode:'', contractType:'', seniority:'',
  summary:'', objective:'', responsibilities:[], requiredSkills:['React','TypeScript'],
  preferredSkills:['Docker'], technologies:[], education:[], experience:[], keywords:[], warnings:[],
  requirements:[req('React','React is required.'),req('TypeScript','TypeScript is required.'),req('Docker','Docker is preferred.','PREFERRED')],
});
const profile = career => ({...career.emptyProfile('test@example.org'), skills:'React, TypeScript'});
const params = (career, overrides={}) => ({ actorId:randomUUID(), input:{ description, language:'en',profile:profile(career),...overrides } });

test('stage10 REAL graph: source-anchored extraction, deterministic score and ordered approval-only plan', async () => {
 const {run,career,matcher}=await runtime();let calls=0;
 const options=params(career);
 const result=await run({...options,deps:{analyze:async (text,lang,signal)=>{
   calls++;assert.equal(text,description);assert.equal(lang,'en');assert.equal(signal.aborted,false);return analysis();
 }}});
 assert.equal(calls,1);
 const expected=matcher.matchJob(options.input.profile,result.analysis);
 assert.equal(result.match.overallScore,expected.overallScore);
 assert.deepEqual(result.match.requirements,expected.requirements);
 assert.equal(result.match.version,1);
 assert.equal(result.match.resumePlan.length,3);
 assert.equal(result.match.resumePlan[0].priority,'REQUIRED');
 assert.ok(result.match.resumePlan.every(item=>item.kind==='SELECT_RESUME' && item.requiresApproval));
 assert.ok(result.match.resumePlan.every(item=>!('proposedText' in item)));
});
test('stage10 REAL graph: valid saved analysis bypasses AI extraction', async () => {
 const {run,career}=await runtime();let calls=0;
 const result=await run({...params(career,{savedAnalysis:analysis()}),deps:{analyze:async()=>{calls++;throw Error('must not extract');}}});
 assert.equal(calls,0);assert.equal(result.analysis.requirements.length,3);
});
test('stage10 REAL graph: stale citations force re-extraction', async () => {
 const {run,career}=await runtime();let calls=0;
 const stale={...analysis(),requirements:[req('React','Kubernetes required.')]};
 await run({...params(career,{savedAnalysis:stale}),deps:{analyze:async()=>{calls++;return analysis();}}});
 assert.equal(calls,1);
});
test('stage10 REAL graph: unsupported model claims fail closed', async () => {
 const {run,career}=await runtime();
 await assert.rejects(run({...params(career),deps:{analyze:async()=>({...analysis(),requirements:[req('Kubernetes','Kubernetes required.')]})}}));
});
test('stage10 REAL graph: same data scores identically regardless of language', async () => {
 const {run,career}=await runtime();
 const english=await run(params(career,{savedAnalysis:analysis()}));
 const french=await run(params(career,{savedAnalysis:analysis(),language:'fr'}));
 assert.equal(english.match.overallScore,french.match.overallScore);
 assert.deepEqual(english.match.requirements,french.match.requirements);
 assert.notEqual(english.match.resumePlan[0].nextStep,french.match.resumePlan[0].nextStep);
});
test('stage10 REAL graph: resume evidence is distinguished from profile evidence', async () => {
 const {run,career}=await runtime();
 const resume={title:'Frontend Engineer',contact:{name:'Test'},summary:['React and TypeScript'],experiences:[],skills:[]};
 const result=await run(params(career,{savedAnalysis:analysis(),resume}));
 assert.equal(result.match.source,'PROFILE_AND_RESUME');
 assert.ok(result.match.resumePlan.every(item=>item.kind!=='SELECT_RESUME'));
 assert.ok(result.match.resumePlan.every(item=>item.evidencePaths.every(path=>path.startsWith('cv.')||path.startsWith('profile.'))));
});
test('stage10 REAL graph: identity, limits and cancellation prevent extraction', async () => {
 const {run,career}=await runtime();let calls=0;const deps={analyze:async()=>{calls++;return analysis();}};
 await assert.rejects(run({...params(career),actorId:'',deps}),e=>e.code==='AGENT_INVALID_IDENTITY');
 await assert.rejects(run({...params(career),input:{...params(career).input,description:'Too short'},deps}),e=>e.code==='AGENT_MODEL_INPUT_INVALID');
 const controller=new AbortController(); controller.abort();
 await assert.rejects(run({...params(career),signal:controller.signal,deps}));
 assert.equal(calls,0);
});
