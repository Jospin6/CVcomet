/** Pure stage 06 regression tests: no database, API keys, LLM or LangGraph package. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { reconcileExtractedProfile } from '../src/lib/career-profile/merge.ts';
import { verifyExtractedEvidence } from '../src/lib/agentic/agents/profile/tools/verify-evidence.tool.ts';

const baseline=()=>({name:'',email:'owner@example.org',phone:'',address:'',headline:'',summary:'',skills:'',languages:'',hobbies:'',
  linkedin:'',github:'',portfolio:'',jobPreferences:{industry:'',seniority:'',residenceCountry:'',employmentTypes:[],salaryRate:'yearly',minimumSalary:null},
  careerGoal:'BETTER_JOB',experienceLevel:'PROFESSIONAL',targetJobTitle:'Engineer',targetIndustry:'Technology',targetCountry:'FR',
  preferredWorkMode:'REMOTE',targetMarket:'FR',referralSource:'FRIEND',resumeSource:'UPLOAD',
  experiences:[],education:[],projects:[],certifications:[],awards:[],professionalLinks:[]});
const source=()=>({...baseline(),name:'Candidate',skills:'TypeScript',
  experiences:[{id:randomUUID(),title:'Engineer',company:'Acme',location:'',start:'2020',end:'',description:'Created API'}]});

test('stage06: only empty professional fields filled, account email and preferences untouched',()=>{
  const current=baseline();
  const {proposal,review}=reconcileExtractedProfile(current,{name:'Alice',email:'imposter@example.org',
    targetMarket:'US',careerGoal:'FIRST_JOB',targetCountry:'US',targetJobTitle:'Doctor',
    skills:'Python',jobPreferences:{industry:'Finance',minimumSalary:80000},
  });
  assert.equal(proposal.name,'Alice');assert.equal(proposal.skills,'Python');
  assert.equal(proposal.email,current.email);assert.equal(proposal.targetMarket,'FR');
  assert.equal(proposal.careerGoal,'BETTER_JOB');assert.equal(proposal.targetCountry,'FR');
  assert.deepEqual(proposal.jobPreferences,current.jobPreferences);
  assert.deepEqual(review.conflicts,[{field:'email',kind:'existing_value'}]);
  assert.equal(review.status,'requires_confirmation');
});
test('stage06: non-empty facts survive; conflicts reported rather than overwriting',()=>{
  const current=source();
  const {proposal,review}=reconcileExtractedProfile(current,{name:'Other',skills:'Python'});
  assert.equal(proposal.name,'Candidate');assert.equal(proposal.skills,'TypeScript');
  assert.deepEqual(review.conflicts,[{field:'name',kind:'existing_value'},{field:'skills',kind:'existing_value'}]);
});
test('stage06: identical entries are not duplicated, existing owned IDs preserved',()=>{
  const current=source();const existing=current.experiences[0];
  const {proposal,review}=reconcileExtractedProfile(current,{experiences:[{...existing,id:randomUUID()}]});
  assert.equal(proposal.experiences.length,1);assert.equal(proposal.experiences[0].id,existing.id);
  assert.equal(review.ignoredDuplicates.experiences,1);
});
test('stage06: same job identity with different descriptions is flagged, not appended',()=>{
  const current=source();
  const {proposal,review}=reconcileExtractedProfile(current,{experiences:[{title:' Engineer ',company:'ACME',start:'2020',description:'Different claims'}]});
  assert.equal(proposal.experiences.length,1);
  assert.ok(review.conflicts.some(x=>x.field==='experiences'&&x.kind==='possible_duplicate'));
});
test('stage06: distinct jobs are appended without importing untrusted IDs',()=>{
  const current=source();const rogueId=randomUUID();
  const {proposal,review}=reconcileExtractedProfile(current,{experiences:[{id:rogueId,title:'Developer',company:'Beta',start:'2022',description:'API'}]});
  assert.equal(proposal.experiences.length,2);assert.equal(proposal.experiences[1].id,undefined);
  assert.equal(review.addedRecords.experiences,1);
});
test('stage06: incomplete records remain for human review, never poison profile validation',()=>{
  const {proposal,review}=reconcileExtractedProfile(baseline(),{
    experiences:[{title:'',company:'Acme',description:'A'}],
    education:[{degree:'',school:'MIT'}],
    certifications:[{name:'',organization:'Example'}],
    professionalLinks:[{label:'LinkedIn',url:''}],
  });
  assert.equal(proposal.experiences.length,0);assert.equal(proposal.education.length,0);
  assert.equal(proposal.professionalLinks.length,0);
  assert.equal(review.incompleteRecords.experiences,1);
  assert.equal(review.incompleteRecords.education,1);
  assert.equal(review.incompleteRecords.professionalLinks,1);
});
test('stage06: duplicate incoming entries appended at most once',()=>{
  const current=baseline();
  const record={title:'Data Engineer',company:'Acme',start:'2024',description:'SQL'};
  const {proposal,review}=reconcileExtractedProfile(current,{experiences:[record,{...record}]});
  assert.equal(proposal.experiences.length,1);
  assert.equal(review.addedRecords.experiences,1);
  assert.equal(review.ignoredDuplicates.experiences,1);
});
test('stage06: existing collections are not mutated by the reconciliation',()=>{
  const current=source();const before=structuredClone(current);
  reconcileExtractedProfile(current,{experiences:[{title:'Another',company:'Second',start:'2023'}]});
  assert.deepEqual(current,before);
});
test('stage06: no hidden model-provided field rewrites user ownership or onboarding preferences',()=>{
  const current=source();const out=reconcileExtractedProfile(current,{email:'changed@x.org',resumeSource:'SCRATCH',
    preferredWorkMode:'ONSITE',referralSource:'OTHER'});
  assert.equal(out.proposal.resumeSource,'UPLOAD');
  assert.equal(out.proposal.preferredWorkMode,'REMOTE');
  assert.equal(out.proposal.email,'owner@example.org');
});
test('stage06: code boundary uses real StateGraph and never auto-saves profiles',()=>{
  const base='src/lib/agentic/agents/profile';
  for(const name of ['agent/profile.agent.ts','agent/graph.ts','agent/state.ts','nodes/load-profile.node.ts','nodes/extract.node.ts',
    'nodes/reconcile.node.ts','nodes/review.node.ts','nodes/verify.node.ts','tools/verify-evidence.tool.ts','prompts/extract.prompt.ts','tools/load-profile.tool.ts','tools/extract-resume.tool.ts',
    'tools/reconcile-profile.tool.ts']) assert.ok(fs.existsSync(`${base}/${name}`),name);
  const graph=fs.readFileSync(`${base}/agent/graph.ts`,'utf8');
  const api=fs.readFileSync('src/app/api/career-profile/import/route.ts','utf8');
  const save=fs.readFileSync('src/app/api/career-profile/route.ts','utf8');
  assert.match(graph,/new StateGraph\(ProfileAgentState\)/);
  for(const step of ['load_profile','extract','verify','reconcile','review']) assert.ok(graph.includes(`.addNode("${step}"`));
  assert.doesNotMatch(graph,/\.compile\(\s*\{\s*checkpointer|\.saveCareerProfile\(/);
  assert.match(api,/runProfileImportAgent/);
  assert.match(api,/assertTrustedWriteOrigin/);
  assert.match(save,/saveProfileSchema\.parse/);assert.match(save,/saveCareerProfile/);
  assert.match(fs.readFileSync('src/components/career-profile/career-profile-page.tsx','utf8'),/setImportReview/);
});

test('stage06: evidence check removes a fabricated employer and nonexistent name',()=>{
  const facts={name:'Invented Name',skills:'Python, ImaginaryTech',
    experiences:[{title:'Engineer',company:'Fabricated Inc',start:'2024'}],
    education:[{degree:'BSc',school:'University of Nairobi'}],
    projects:[],certifications:[],awards:[],professionalLinks:[]};
  const {verified,unverifiedFields,evidenceMode}=verifyExtractedEvidence(facts,'Engineer at Acme using Python.');
  assert.equal(evidenceMode,'text_verified');
  assert.equal(verified.name,'');assert.equal(verified.skills,'Python');
  assert.equal(verified.experiences.length,0);assert.equal(verified.education.length,0);
  for(const field of ['name','skills','experiences','education']) assert.ok(unverifiedFields.includes(field));
});
test('stage06: evidence check keeps supported employer and skills',()=>{
  const facts={name:'Alex Doe',skills:'Python, SQL',experiences:[{title:'Engineer',company:'Acme',start:'2024'}],
    education:[],projects:[],certifications:[],awards:[],professionalLinks:[]};
  const {verified,unverifiedFields}=verifyExtractedEvidence(facts,'Alex Doe. Engineer at Acme using Python and SQL since 2024.');
  assert.equal(verified.name,'Alex Doe');assert.equal(verified.skills,'Python, SQL');
  assert.equal(verified.experiences.length,1);assert.deepEqual(unverifiedFields,[]);
});
test('stage06: scanned PDF never pretends to have verified facts from missing OCR text',()=>{
  const facts={name:'Someone',skills:'Unknown',experiences:[],education:[],projects:[],certifications:[],awards:[],professionalLinks:[]};
  const result=verifyExtractedEvidence(facts,'');
  assert.equal(result.evidenceMode,'native_pdf_review');assert.deepEqual(result.verified,facts);
});
