const {test}=require('node:test');
const assert=require('node:assert/strict');
const {read,base,routing,prompt,input,contracts}=require('./agentic-stage16-fixtures.cjs');
const failure=(fn,code)=>assert.throws(fn,e=>e.code===code);

test('stage16 requires authenticated server actor and bounded conversation text',()=>{
  failure(()=>routing.assertSupervisorInput({...input,actorId:''}),'UNAUTHORIZED');
  failure(()=>routing.assertSupervisorInput({...input,message:'X'}),'INVALID_AGENT_MESSAGE');
  failure(()=>routing.assertSupervisorInput({...input,message:'Y'.repeat(6001)}),'INVALID_AGENT_MESSAGE');
  failure(()=>routing.assertSupervisorInput({...input,history:Array.from({length:13},()=>({role:'user',content:'hi'}))}),'INVALID_AGENT_CONTEXT');
  failure(()=>routing.assertSupervisorInput({...input,applicationId:'not-a-uuid'}),'INVALID_APPLICATION_ID');
  routing.assertSupervisorInput(input);
});

test('stage16 all 11 specialist routes are declared, no dynamic names',()=>{
  assert.equal(contracts.SUPERVISOR_SPECIALISTS.length,11);
  assert.deepEqual(Object.keys(routing.SPECIALIST_READS).sort(),[...contracts.SUPERVISOR_SPECIALISTS].sort());
  assert.deepEqual([...routing.SPECIALIST_READS.general],[]);
});

test('stage16 route planner validates allowed domain tools and rejects writes',()=>{
  const accepted=routing.assertSupervisorPlan({specialist:'resume',calls:[{tool:'list_my_resumes',input:{limit:5}}]});
  assert.equal(accepted.specialist,'resume');assert.equal(accepted.calls[0].tool,'list_my_resumes');
  failure(()=>routing.assertSupervisorPlan({specialist:'resume',calls:[{tool:'send_application_email',input:{}}]}),'AGENT_PLAN_REJECTED');
  failure(()=>routing.assertSupervisorPlan({specialist:'resume',calls:[{tool:'get_my_application',input:{}}]}),'AGENT_PLAN_REJECTED');
  failure(()=>routing.assertSupervisorPlan({specialist:'general',calls:[{tool:'get_my_profile',input:{}}]}),'AGENT_PLAN_REJECTED');
  failure(()=>routing.assertSupervisorPlan({specialist:'general',calls:[],userId:'other'}),'AGENT_PLAN_REJECTED');
  failure(()=>routing.assertSupervisorPlan({specialist:'shell',calls:[]}),'AGENT_PLAN_REJECTED');
});

test('stage16 duplicate tools, oversized payload and unknown owner IDs fail closed',()=>{
  failure(()=>routing.assertSupervisorPlan({specialist:'resume',calls:[{tool:'list_my_resumes',input:{}},{tool:'list_my_resumes',input:{}}]}),'AGENT_PLAN_REJECTED');
  failure(()=>routing.assertSupervisorPlan({specialist:'resume',calls:[{tool:'get_my_resume',input:{resumeId:'id',userId:'other'}}]}),'AGENT_PLAN_REJECTED');
  failure(()=>routing.assertSupervisorPlan({specialist:'resume',calls:[{tool:'get_my_resume',input:{body:'x'.repeat(1200)}}]}),'AGENT_PLAN_REJECTED');
});

test('stage16 context app ID is always forced by server, including greeting',()=>{
  const id='11111111-1111-4111-8111-111111111111';
  const result=routing.assertSupervisorPlan({specialist:'general',calls:[]},id);
  assert.equal(result.calls.length,1);assert.equal(result.calls[0].tool,'get_my_application');
  assert.equal(result.calls[0].input.applicationId,id);
  const mismatched=routing.assertSupervisorPlan({specialist:'application',calls:[{tool:'get_my_application',input:{applicationId:'22222222-2222-4222-8222-222222222222'}}]},id);
  assert.equal(mismatched.calls[0].input.applicationId,id);
});

test('stage16 application context retains 3-tool hard cap and no duplicate read',()=>{
  const id='11111111-1111-4111-8111-111111111111';
  const result=routing.assertSupervisorPlan({specialist:'application',calls:[
    {tool:'list_my_applications',input:{}},{tool:'list_my_application_packets',input:{}},
    {tool:'get_my_application',input:{applicationId:id}},
  ]},id);
  assert.equal(result.calls.length,3);assert.equal(result.calls.filter(c=>c.tool==='get_my_application').length,1);
});

test('stage16 model instruction is untrusted and route explanation never claims side effects',()=>{
  assert.match(prompt.supervisorPlannerPolicy,/UNTRUSTED DATA/);
  assert.match(prompt.supervisorAnswerPolicy('interview_voice'),/consented LiveKit/);
  assert.match(prompt.supervisorAnswerPolicy('application'),/READY never means sent or submitted/);
  assert.match(prompt.supervisorAnswerPolicy('job_match'),/saved insights/);
  assert.match(prompt.supervisorAnswerPolicy('resume'),/dedicated CV editor/);
});

test('stage16 chat and both API routes continue through single supervised service',()=>{
  const service=read('src/lib/career-os/agent-service.ts');
  const missions=read('src/lib/career-os/mission-service.ts');
  assert.match(service,/runCareerSupervisorAgent\(/);
  assert.match(service,/executeCareerReadTool\(actor, tool, input\)/);
  assert.match(service,/reserveProfileAI\(actor.id, "CAREER_ASSISTANT"\)/g);
  assert.equal((service.match(/reserveProfileAI\(actor.id, "CAREER_ASSISTANT"\)/g)||[]).length,2);
  assert.match(missions,/runCareerAgent\(actor, message, signal/);
  assert.match(read('src/app/api/assistant/route.ts'),/runCareerAgent\(actor, message, req.signal/);
  assert.match(read('src/app/api/career/v1/agent/route.ts'),/runCareerAgent\(actor, body.message, req.signal/);
});

test('stage16 graph is non-writing, no checkpoint or uncontrolled tool execution',()=>{
  for(const file of ['agent/graph.ts','agent/supervisor.agent.ts','nodes/delegate.node.ts']){
    const source=read(base+file);
    assert.doesNotMatch(source,/prisma\.|\.create\(|\.update\(|\.delete\(|\.send\(/);
    assert.doesNotMatch(source,/interrupt\(|checkpointer/);
  }
});
