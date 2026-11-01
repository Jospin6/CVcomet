import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register(new URL('./agentic-stage06-loader.mjs',import.meta.url));

async function runtime() {
 try {
   const [agent,editor,legacy]=await Promise.all([
     import('../src/lib/agentic/agents/job-discovery/agent/job-discovery.agent.ts'),
     import('../src/lib/resume-editor.ts'),
     import('../src/lib/find-jobs/for-you.ts'),
   ]);
   return { run:agent.runJobDiscoveryAgent,editor,legacy };
 }catch(error){
   if(error?.code==='ERR_MODULE_NOT_FOUND'||error?.code==='MODULE_NOT_FOUND')
     assert.fail('Install npm dependencies and run prisma generate for actual LangGraph integration tests.');
   throw error;
 }
}
const job=(id,overrides={})=>({
 id,provider:'REMOTIVE',externalId:id,title:'Frontend React Developer',
 company:'Company '+id,description:'We need a Frontend React Developer with React and TypeScript skills to build accessible interfaces. Strong collaboration is required.',
 location:'US',remote:true,contractType:'full-time',seniority:'mid',
 salaryMin:null,salaryMax:null,currency:null,publishedAt:'2026-10-20T14:00:00Z',expiresAt:null,
 sourceUrl:`https://jobs.example.org/${id}`,applyUrl:`https://jobs.example.org/apply/${id}`,
 skills:['React','TypeScript'],eligibleCountries:['US'],logoUrl:null,attribution:'Real provider',...overrides,
});
const resume={title:'Frontend Developer',summary:['React web applications'],skills:[{hardskills:'React, TypeScript'}],
 experiences:[{title:'Frontend Engineer',company:'Acme',description:['Built React applications']}]};
const preferences={cvId:'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',title:'Frontend Developer',countries:[],
 postedWithin:'any',contracts:[],seniorities:[],workplaces:[],minimumAnnualUsd:null,visaSponsorship:false};
const matching=()=>({version:1,source:'PROFILE_AND_RESUME',overallScore:76,
 skillScore:78,keywordScore:75,experienceScore:70,educationScore:null,
 components:{essentialSkills:78,desirableSkills:null,experience:70,qualifications:null},
 evaluatedCount:2,unverifiedCount:0,totalCount:2,
 requirements:[{title:'React',status:'DEMONSTRATED',priority:'REQUIRED',evidenceSources:[]}],
 matchedSkills:['React'],missingSkills:[],unverifiedSkills:[],recommendations:[],scoreExplanation:'verified'});

test('stage11 REAL LangGraph: real-source shortlist, reuse Job Match adapter, no invented percentages',async()=>{
 const {run,editor,legacy}=await runtime();
 const input={resume:editor.normalizeEditorResume(resume), preferences:legacy.matchingPreferencesSchema.parse(preferences),language:'en'};
 let authorized=0,matched=[];
 const result=await run({actorId:'user-11',input,deps:{
   discover:async()=>({jobs:Array.from({length:5},(_,i)=>job(`id-${i}`)),warnings:[]}),
   authorizeDeepMatch:async()=>{authorized++},
   match:async(vacancy,cv,language)=>{matched.push(vacancy.id);assert.equal(language,'en');assert.equal(cv.title,input.resume.title);return matching();},
 }});
 assert.equal(authorized,1);
 assert.deepEqual(matched,['id-0','id-1','id-2']);
 assert.equal(result.jobs.length,5);
 assert.equal(result.verifiedCount,3);
 assert.equal(result.matchingStatus,'partial');
 assert.deepEqual(result.jobs.map(x=>x.match.score),[76,76,76,null,null]);
 assert.equal(result.jobs[0].match.matched[0],'React');
});
test('stage11 REAL LangGraph: empty filters do not invoke expensive matching',async()=>{
 const {run,editor,legacy}=await runtime();
 let aiCalls=0;
 const result=await run({actorId:'user-11',input:{resume:editor.normalizeEditorResume(resume),preferences:legacy.matchingPreferencesSchema.parse({...preferences,countries:['CD']}),language:'fr'},deps:{
 discover:async()=>({jobs:[job('excluded')],warnings:[]}),
 authorizeDeepMatch:async()=>{aiCalls++},
 }});
 assert.equal(aiCalls,0);assert.equal(result.jobs.length,0);assert.equal(result.reason,'NO_MATCHING_OFFERS');
});
test('stage11 REAL LangGraph: rejects unauthenticated and invalid CV choice',async()=>{
 const {run,editor,legacy}=await runtime();
 const input={resume:editor.normalizeEditorResume(resume),preferences:legacy.matchingPreferencesSchema.parse(preferences),language:'en'};
 await assert.rejects(run({actorId:'',input}),error=>error.code==='AGENT_INVALID_IDENTITY');
 await assert.rejects(run({actorId:'user-11',input:{...input,preferences:{...preferences,cvId:null}}}),error=>error.code==='AGENT_MODEL_INPUT_INVALID');
 const controller=new AbortController();controller.abort();
 await assert.rejects(run({actorId:'user-11',input,signal:controller.signal}));
});
