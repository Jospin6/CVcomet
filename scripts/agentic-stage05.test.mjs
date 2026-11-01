/** Offline stage 05 tests: fake repository; no DB, models or user credentials. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { AgenticError } from '../src/lib/agentic/core/errors.ts';
import { createCareerContextEngine } from '../src/lib/agentic/context/career/engine.ts';
import { parseContextRequest } from '../src/lib/agentic/context/career/policy.ts';
import { AgentToolRegistry } from '../src/lib/agentic/core/tools/agent-tool-registry.ts';
import { registerCareerContextReadTool } from '../src/lib/agentic/context/career/tool.ts';

const owner=randomUUID(), other=randomUUID();
const resumeId=randomUUID(), jobId=randomUUID(), appId=randomUUID(), letterId=randomUUID();
const identity=(agentId='resume',actorId=owner)=>({runId:randomUUID(),agentId,access:{kind:'authenticated',actorId}});
const request=(agentId,selectors,actorId=owner)=>({identity:identity(agentId,actorId),selectors});
const failure=code=>e=>e instanceof AgenticError && e.code===code;
const profile={revision:4, name:'PRIVATE NAME',email:'private@email.local',phone:'123SECRET',address:'PRIVATE STREET',
  headline:'AI Engineer',skills:'Python, TypeScript',summary:'Builds reliable systems',
  experiences:[{id:randomUUID(),title:'Engineer',company:'Company',description:'Built an API',salary:'SECRET SALARY'}],
  education:[{degree:'BSc',school:'University'}], jobPreferences:{industry:'Technology',seniority:'mid',residenceCountry:'CD',employmentTypes:['full-time'],token:'SECRET TOKEN'},
  aiQuota:300,subscriptionId:'PRIVATE BILLING'};
const resume={id:resumeId,revision:8,title:'Engineering CV',summary:['Visible summary'],
  experiences:[{title:'Engineer',company:'Company',description:['Real experience'],email:'SECRET'}],
  skills:[{hardskills:'Python',softskills:'Teamwork',tools:'PostgreSQL'}],
  projects:[{title:'PRIVATE PROJECT',description:'Hidden project'}],contact:{name:'FULL NAME',phone:'PRIVATE PHONE',email:'private@email.local',city:'PRIVATE CITY'},
  design:{layout:'classic',paper:'A4',hiddenSections:['projects'],sectionOrder:['summary','skills','projects']},secretAccessToken:'SECRET'};
const job={id:jobId,title:'Engineer',company:'Acme',description:'Job description text',requiredSkills:['Python'],
  privateOwnerEmail:'SECRET'};
const application={id:appId,cvId:resumeId,jobId,coverLetterId:letterId,company:'Acme',jobTitle:'Engineer',status:'SAVED',
  notes:'SECRET PERSONAL NOTE',nextAction:'Prepare documents'};
const letter={id:letterId,revision:3,cvId:resumeId,jobId,recipientName:'Hiring Manager',companyName:'Acme',
  introduction:'Hello',body:'My experience',conclusion:'Regards',senderEmail:'SECRET LETTER EMAIL'};
const calls=[];
function repository(){return {
  async getProfile(actorId){calls.push(['profile',actorId]);return actorId===owner?profile:null;},
  async getResume(actorId,id){calls.push(['resume',actorId,id]);return actorId===owner&&id===resumeId?resume:null;},
  async getJob(actorId,id){calls.push(['job',actorId,id]);return actorId===owner&&id===jobId?job:null;},
  async getApplication(actorId,id){calls.push(['application',actorId,id]);return actorId===owner&&id===appId?application:null;},
  async getCoverLetter(actorId,id){calls.push(['cover-letter',actorId,id]);return actorId===owner&&id===letterId?letter:null;},
};}

test('stage05: only requested resources fetched; profile PII, billing, internal IDs omitted',async()=>{
  calls.length=0;
  const snapshot=await createCareerContextEngine(repository()).load(request('resume',{profile:true,resumeId}));
  assert.deepEqual(calls.map(x=>x[0]),['profile','resume']);
  assert.equal(snapshot.references.profile.revision,4);
  assert.equal(snapshot.references.resume.revision,8);
  for(const secret of ['PRIVATE NAME','private@email.local','123SECRET','PRIVATE STREET','SECRET SALARY','PRIVATE BILLING','SECRET TOKEN','SECRET ACCESS']) {
    assert.ok(!snapshot.modelContext.includes(secret),secret);
  }
  assert.ok(!snapshot.modelContext.includes(owner));
  assert.ok(!snapshot.modelContext.includes(resumeId));
  assert.ok(snapshot.modelContext.includes('AI Engineer'));
  assert.ok(snapshot.modelContext.includes('Visible summary'));
  assert.ok(snapshot.modelContext.includes('PRIVATE PROJECT'));
  assert.ok(!Object.hasOwn(snapshot.facts.profile,'preferences'), 'resume agent should not receive job-search salary preferences');
  assert.equal(snapshot.facts.resume.contactPresence.email,true);
});

test('stage05: ATS and Job Match cannot request profile and cannot see hidden sections',async()=>{
  for(const agent of ['ats','job-match']) {
    calls.length=0;
    await assert.rejects(createCareerContextEngine(repository()).load(request(agent,{profile:true})),failure('AGENT_CONTEXT_FORBIDDEN'));
    assert.equal(calls.length,0);
    const snapshot=await createCareerContextEngine(repository()).load(request(agent,{resumeId,jobId}));
    assert.ok(!snapshot.modelContext.includes('PRIVATE PROJECT'));
    assert.ok(!Object.hasOwn(snapshot.facts.resume.sections,'projects'));
    assert.ok(snapshot.modelContext.includes('Python'));
    assert.deepEqual(calls.map(x=>x[0]),['resume','job']);
  }
});

test('stage05: all resource lookups are actor-scoped, missing owned resource fails closed',async()=>{
  const ctx=createCareerContextEngine(repository());
  await assert.rejects(ctx.load(request('resume',{resumeId},other)),failure('AGENT_CONTEXT_NOT_FOUND'));
  await assert.rejects(ctx.load(request('profile',{profile:true},other)),failure('AGENT_CONTEXT_NOT_FOUND'));
  await assert.rejects(ctx.load(request('application',{applicationId:appId},other)),failure('AGENT_CONTEXT_NOT_FOUND'));
  assert.ok(calls.some(x=>x[1]===other));
});

test('stage05: public demos and unknown agents have no private scopes',async()=>{
  const engine=createCareerContextEngine(repository());
  await assert.rejects(engine.load({identity:{runId:randomUUID(),agentId:'demo',access:{kind:'public_demo'}},selectors:{profile:true}}),failure('AGENT_ACCESS_DENIED'));
  await assert.rejects(engine.load(request('new-agent',{profile:true})),failure('AGENT_CONTEXT_FORBIDDEN'));
});

test('stage05: strict selectors reject unknown keys, forged userId, unsupported ID, false profile',()=>{
  for(const selectors of [{profile:false},{profile:true,userId:other},{resumeId:'not-a-uuid'},{resumeId:''},{},
    {profile:true,ids:[resumeId]}, {jobId:100}]) {
    assert.throws(()=>parseContextRequest(request('resume',selectors)),failure('AGENT_CONTEXT_INVALID'));
  }
});

test('stage05: dossier consistency rejects unrelated resume, job or letter',async()=>{
  const engine=createCareerContextEngine(repository());
  await assert.rejects(engine.load(request('application',{applicationId:appId,resumeId:randomUUID()})),failure('AGENT_CONTEXT_INCONSISTENT'));
  await assert.rejects(engine.load(request('application',{applicationId:appId,jobId:randomUUID()})),failure('AGENT_CONTEXT_INCONSISTENT'));
  await assert.rejects(engine.load(request('application',{applicationId:appId,coverLetterId:randomUUID()})),failure('AGENT_CONTEXT_INCONSISTENT'));
  const snapshot=await engine.load(request('application',{applicationId:appId,resumeId,jobId,coverLetterId:letterId}));
  assert.ok(snapshot.modelContext.includes('My experience'));
  assert.ok(!snapshot.modelContext.includes('SECRET PERSONAL NOTE'));
  assert.ok(!snapshot.modelContext.includes('SECRET LETTER EMAIL'));
});

test('stage05: cover letter cannot be mixed with different selected CV or job',async()=>{
  const repo=repository();
  repo.getCoverLetter=async()=>({...letter,cvId:randomUUID()});
  await assert.rejects(createCareerContextEngine(repo).load(request('cover-letter',{coverLetterId:letterId,resumeId})),failure('AGENT_CONTEXT_INCONSISTENT'));
});

test('stage05: abort before read and after pending read, without leaking data',async()=>{
  const aborted=new AbortController();aborted.abort();
  calls.length=0;
  await assert.rejects(createCareerContextEngine(repository()).load({...request('resume',{resumeId}),signal:aborted.signal}),failure('AGENT_CANCELLED'));
  assert.equal(calls.length,0);
  const ctrl=new AbortController();
  const repo=repository();repo.getResume=async()=>{ctrl.abort();return resume;};
  await assert.rejects(createCareerContextEngine(repo).load({...request('resume',{resumeId}),signal:ctrl.signal}),failure('AGENT_CANCELLED'));
});

test('stage05: unavailable repository errors are sanitized',async()=>{
  const repo=repository();repo.getResume=async()=>{throw new Error('postgres://private-password@db');};
  await assert.rejects(createCareerContextEngine(repo).load(request('resume',{resumeId})),failure('AGENT_CONTEXT_UNAVAILABLE'));
});

test('stage05: contextual output capped and never serializes arbitrary record fields',async()=>{
  const repo=repository();
  repo.getResume=async()=>({...resume,summary:['X'.repeat(100_000)],tokens:{private:'SECRET VALUE'}});
  const result=await createCareerContextEngine(repo).load(request('resume',{resumeId}));
  assert.ok(result.modelContext.length<30_000);
  assert.ok(!result.modelContext.includes('SECRET VALUE'));
  assert.equal(result.facts.resume.sections.summary[0].length,1500);
});

test('stage05: Prisma source explicitly enforces owner on every resource query',()=>{
  const src=fs.readFileSync(new URL('../src/lib/agentic/context/career/prisma-repository.ts',import.meta.url),'utf8');
  assert.match(src,/getCareerProfile\(ownerId\)/);
  assert.equal((src.match(/conversation: \{ userId: ownerId \}/g)||[]).length,2);
  assert.equal((src.match(/where: \{ id, userId: ownerId \}/g)||[]).length,2);
  assert.ok(!src.includes('findUnique({ where: { id }'));
});

test('stage05: Stage04 tool gateway invokes only allowlisted, actor-scoped context reads',async()=>{
  const registry=new AgentToolRegistry();
  registerCareerContextReadTool(registry,repository());
  const controller=new AbortController();
  const ctx=(agentId,actorId=owner)=>({identity:identity(agentId,actorId),signal:controller.signal});
  assert.deepEqual(registry.listForAgent(identity('ats')),['read_career_context']);
  assert.deepEqual(registry.listForAgent(identity('demo')),[]);
  const snapshot=await registry.invoke('read_career_context',{resumeId,jobId},ctx('ats'));
  assert.ok(!snapshot.modelContext.includes('PRIVATE PROJECT'));
  await assert.rejects(registry.invoke('read_career_context',{profile:true},ctx('ats')),failure('AGENT_TOOL_FORBIDDEN'));
  await assert.rejects(registry.invoke('read_career_context',{resumeId,userId:owner},ctx('resume')),failure('AGENT_TOOL_FORBIDDEN'));
  await assert.rejects(registry.invoke('read_career_context',{resumeId},ctx('resume',other)),failure('AGENT_CONTEXT_NOT_FOUND'));
});

test('stage05: explicit job discovery preferences are available without private contact data',async()=>{
  const snapshot=await createCareerContextEngine(repository()).load(request('job-discovery',{profile:true,resumeId}));
  assert.equal(snapshot.facts.profile.preferences.residenceCountry,'CD');
  assert.ok(!snapshot.modelContext.includes('private@email.local'));
  assert.ok(!snapshot.modelContext.includes('PRIVATE PROJECT'));
});
