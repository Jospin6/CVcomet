/** Required real LangGraph profile-agent integration (no DB, network, API keys).
 * Run after npm install + prisma generate; agent tools are injected with fakes.
 * This test MUST fail rather than skip when LangGraph is unavailable. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { register } from 'node:module';

register(new URL('./agentic-stage06-loader.mjs', import.meta.url));

test('stage06 REAL LangGraph: profile import reads actor, extracts, reconciles, requires explicit save',async()=>{
  let runProfileImportAgent;
  try { ({runProfileImportAgent}=await import('../src/lib/agentic/agents/profile/agent/profile.agent.ts')); }
  catch(error) {
    if(error?.code==='ERR_MODULE_NOT_FOUND'||error?.code==='MODULE_NOT_FOUND') {
      assert.fail('Install project npm dependencies and run prisma generate; the real LangGraph integration cannot be skipped.');
    }
    throw error;
  }
  const actorId=randomUUID();
  const profile={name:'',email:'verified@example.org',phone:'',address:'',headline:'',summary:'',skills:'',languages:'',hobbies:'',
    linkedin:'',github:'',portfolio:'',careerGoal:'BETTER_JOB',experienceLevel:'PROFESSIONAL',targetJobTitle:'Engineer',targetIndustry:'IT',
    targetCountry:'FR',preferredWorkMode:'REMOTE',targetMarket:'FR',referralSource:'',resumeSource:'UPLOAD',
    jobPreferences:{industry:'IT',seniority:'mid',residenceCountry:'',employmentTypes:[],salaryRate:'yearly',minimumSalary:null},
    experiences:[],education:[],projects:[],certifications:[],awards:[],professionalLinks:[],revision:7,onboardingCompletedAt:null};
  let readCount=0,extractCount=0,writeCount=0;
  const result=await runProfileImportAgent({actorId,deps:{document:{format:'txt',text:'Alex Doe — Engineer at Acme, Python'},
    async readProfile(userId){assert.equal(userId,actorId);readCount++;return profile;},
    async extract(doc){assert.equal(doc.format,'txt');extractCount++;return {name:'Alex Doe',email:'other@example.org',skills:'Python',
      experiences:[{title:'Engineer',company:'Acme',location:'',start:'2022',end:'',description:'Python'}]};},
  }});
  assert.equal(readCount,1);assert.equal(extractCount,1);assert.equal(writeCount,0);
  assert.equal(result.baseRevision,7);assert.equal(result.requiresConfirmation,true);
  assert.equal(result.review.status,'requires_confirmation');
  assert.equal(result.proposal.name,'Alex Doe');
  assert.equal(result.proposal.email,'verified@example.org');
  assert.equal(result.proposal.experiences.length,1);
  assert.equal(result.review.conflicts.some(x=>x.field==='email'),true);
  assert.equal('current' in result,false);
  assert.equal('document' in result,false);
});

test('stage06 REAL LangGraph: fail closed when source has no evidence, never persists',async()=>{
  const {runProfileImportAgent}=await import('../src/lib/agentic/agents/profile/agent/profile.agent.ts');
  const {emptyProfile}=await import('../src/lib/career-profile/schema.ts');
  const {ProfileError}=await import('../src/lib/career-profile/http.ts');
  await assert.rejects(runProfileImportAgent({actorId:randomUUID(),deps:{document:{format:'txt',text:'empty'},
    async readProfile(){return {...emptyProfile('owner@example.org'),revision:0,onboardingCompletedAt:null};},
    async extract(){throw new ProfileError(422,'NO_RESUME_DATA');},
  }}),error=>error.code==='AGENT_RUN_FAILED'||error.code==='NO_RESUME_DATA');
});
