import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { AgenticError } from '../src/lib/agentic/core/errors.ts';
import { AgentToolRegistry } from '../src/lib/agentic/core/tools/agent-tool-registry.ts';
import { executeReviewedTool } from '../src/lib/agentic/core/tools/reviewed-execution.ts';
import {
  assertVerifiedApproval, digestToolArguments, makeApprovalRequest, verifyApprovalDecision,
} from '../src/lib/agentic/core/policies/approval.ts';
import { createAgentModelGateway } from '../src/lib/agentic/core/models/model-gateway.ts';

const userId = 'user-004';
const identity = (actorId=userId, agentId='resume') => ({
  runId: randomUUID(), agentId, access: {kind: 'authenticated', actorId},
});
const missionId = randomUUID();
const signal = new AbortController().signal;
const context = (id=identity()) => ({ identity: id, missionId, signal });
const expectCode = code => error => error instanceof AgenticError && error.code === code;
const input = {resourceId:'cv-123',revision:'5',patch:{summary:'Improved summary'}};

function makeRegistry() {
  let executions=0, authorizations=0;
  let version='5';
  const committed=new Map();
  const registry=new AgentToolRegistry();
  registry.register({
    name:'edit_summary', capability:'write', permittedAgents:['resume'],
    parse(raw) {
      if (!raw || typeof raw!=='object' || typeof raw.resourceId!=='string' || typeof raw.revision!=='string' ||
          typeof raw.patch?.summary!=='string') throw Error('Invalid model arguments');
      return raw;
    },
    async authorize(raw,ctx) {
      authorizations++;
      if (ctx.identity.access.kind!=='authenticated' || ctx.identity.access.actorId!==userId ||
          raw.resourceId!=='cv-123' || raw.revision!==version) throw Error('PRIVATE_DB_DETAIL');
    },
    target(raw) {return {resourceId:raw.resourceId,revision:raw.revision};},
    executeIdempotently(raw,_ctx,key) {
      if (committed.has(key)) return committed.get(key);
      executions++;
      const result={status:'updated',value:raw.patch.summary};
      committed.set(key,result);
      return result;
    },
  });
  return {registry, get executions(){return executions;}, get authorizations(){return authorizations;}, setVersion(v){version=v;}};
}

test('stage04: deterministic approval fingerprint across map key order and node replay', () => {
  assert.equal(digestToolArguments({a:1,b:{c:'x',d:2}}),digestToolArguments({b:{d:2,c:'x'},a:1}));
  const left=makeApprovalRequest({identity:identity(),missionId,toolName:'edit_summary',target:{resourceId:'cv-123',revision:'5'},input});
  const right=makeApprovalRequest({identity:identity(),missionId,toolName:'edit_summary',target:{resourceId:'cv-123',revision:'5'},input});
  assert.equal(left.challenge.approvalId,right.challenge.approvalId);
  assert.equal(left.challenge.kind,'agent.tool.approval');
  assert.ok(!JSON.stringify(left.challenge).includes('Improved summary'));
  assert.ok(!JSON.stringify(left.challenge).includes(userId));
});

test('stage04: approval is specific to actor, agent, mission, resource revision and exact arguments', () => {
  const make=({i=identity(),m=missionId,args=input,revision='5'}={}) => makeApprovalRequest({identity:i,missionId:m,toolName:'edit_summary',target:{resourceId:'cv-123',revision},input:args});
  const challenge=make().challenge.approvalId;
  assert.notEqual(make({i:identity('user-else')}).challenge.approvalId,challenge);
  assert.notEqual(make({i:identity(userId,'cover-letter')}).challenge.approvalId,challenge);
  assert.notEqual(make({m:randomUUID()}).challenge.approvalId,challenge);
  assert.notEqual(make({revision:'6'}).challenge.approvalId,challenge);
  assert.notEqual(make({args:{...input,patch:{summary:'DIFFERENT'}}}).challenge.approvalId,challenge);
});

test('stage04: malformed/oversized/cyclic tool arguments rejected before approval', () => {
  const cyclic={}; cyclic.self=cyclic;
  assert.throws(()=>digestToolArguments(cyclic),expectCode('AGENT_APPROVAL_INVALID'));
  assert.throws(()=>digestToolArguments({bad:undefined}),expectCode('AGENT_APPROVAL_INVALID'));
  assert.throws(()=>digestToolArguments({payload:'X'.repeat(257_000)}),expectCode('AGENT_APPROVAL_INVALID'));
  assert.throws(()=>makeApprovalRequest({identity:identity(),missionId:'bad',toolName:'edit_summary',target:{resourceId:'cv-123',revision:'5'},input}),expectCode('AGENT_APPROVAL_INVALID'));
});

test('stage04: forged approval from model or HTTP is rejected, even when field values match', async () => {
  const {registry}=makeRegistry();
  const ctx=context();
  const request=await registry.prepareApproval('edit_summary',input,ctx);
  await assert.rejects(registry.invoke('edit_summary',input,ctx),expectCode('AGENT_APPROVAL_REQUIRED'));
  const forged={approvalId:request.challenge.approvalId,actorId:userId,agentId:'resume',missionId,
    toolName:'edit_summary',resourceId:'cv-123',revision:'5',argumentsDigest:request.binding.argumentsDigest,
    idempotencyKey:'fake'};
  await assert.rejects(registry.invoke('edit_summary',input,{...ctx,approval:forged}),expectCode('AGENT_APPROVAL_REQUIRED'));
});

test('stage04: invalid, rejected or mismatched human decisions cannot approve', async () => {
  const {registry}=makeRegistry(); const ctx=context();
  const request=await registry.prepareApproval('edit_summary',input,ctx);
  assert.throws(()=>verifyApprovalDecision(request,{approvalId:request.challenge.approvalId,decision:'reject'},ctx.identity),expectCode('AGENT_APPROVAL_REJECTED'));
  assert.throws(()=>verifyApprovalDecision(request,{approvalId:'wrong',decision:'approve'},ctx.identity),expectCode('AGENT_APPROVAL_INVALID'));
  assert.throws(()=>verifyApprovalDecision(request,{approvalId:request.challenge.approvalId,decision:'approve',actorId:userId},ctx.identity),expectCode('AGENT_APPROVAL_INVALID'));
  assert.throws(()=>verifyApprovalDecision(request,{approvalId:request.challenge.approvalId,decision:'approve'},identity('user-else')),expectCode('AGENT_ACCESS_DENIED'));
});

test('stage04: review -> approved execution; authorizes before AND after interruption', async () => {
  const data=makeRegistry(), ctx=context();
  const result=await executeReviewedTool({registry:data.registry,name:'edit_summary',input,context:ctx,
    review:challenge=>({approvalId:challenge.approvalId,decision:'approve'})});
  assert.equal(result.value,'Improved summary');
  assert.equal(data.executions,1);
  assert.equal(data.authorizations,2);
});

test('stage04: denying review never executes the write', async () => {
  const data=makeRegistry(), ctx=context();
  await assert.rejects(executeReviewedTool({registry:data.registry,name:'edit_summary',input,context:ctx,
    review:challenge=>({approvalId:challenge.approvalId,decision:'reject'})}),expectCode('AGENT_APPROVAL_REJECTED'));
  assert.equal(data.executions,0);
});

test('stage04: a stale document revision cannot be written after approval', async () => {
  const data=makeRegistry();
  await assert.rejects(executeReviewedTool({registry:data.registry,name:'edit_summary',input,context:context(),
    review:challenge=>{data.setVersion('6');return {approvalId:challenge.approvalId,decision:'approve'};}}),expectCode('AGENT_TOOL_FORBIDDEN'));
  assert.equal(data.executions,0);
});

test('stage04: replaying same approved operation gives stable DB idempotency key', async () => {
  const data=makeRegistry(); const ctx=context();
  const request=await data.registry.prepareApproval('edit_summary',input,ctx);
  const receipt=verifyApprovalDecision(request,{approvalId:request.challenge.approvalId,decision:'approve'},ctx.identity);
  assert.equal(receipt.idempotencyKey,`agentic-${request.challenge.approvalId}`);
  assertVerifiedApproval({receipt,request});
  const fake={...receipt};
  assert.throws(()=>assertVerifiedApproval({receipt:fake,request}),expectCode('AGENT_APPROVAL_REQUIRED'));
  await data.registry.invoke('edit_summary',input,{...ctx,approval:receipt});
  await data.registry.invoke('edit_summary',input,{...ctx,approval:receipt});
  assert.equal(data.executions,1);
});

test('stage04: a previously approved operation cannot be changed after approval', async () => {
  const data=makeRegistry(), ctx=context();
  const request=await data.registry.prepareApproval('edit_summary',input,ctx);
  const receipt=verifyApprovalDecision(request,{approvalId:request.challenge.approvalId,decision:'approve'},ctx.identity);
  await assert.rejects(data.registry.invoke('edit_summary',
    {...input,patch:{summary:'Changed after approval'}},{...ctx,approval:receipt}),expectCode('AGENT_APPROVAL_REQUIRED'));
  assert.equal(data.executions,0);
});

test('stage04: tools only callable by allowlisted agents and authenticated actor; no external actions', async () => {
  const data=makeRegistry(), ctx=context(identity(userId,'ats'));
  await assert.rejects(data.registry.prepareApproval('edit_summary',input,ctx),expectCode('AGENT_TOOL_FORBIDDEN'));
  await assert.rejects(data.registry.prepareApproval('edit_summary',input,context(identity('other-user'))),expectCode('AGENT_TOOL_FORBIDDEN'));
  const registry=new AgentToolRegistry();
  registry.register({name:'send_email',capability:'external',permittedAgents:['resume'],parse:x=>x,authorize:()=>{},execute:()=>42});
  await assert.rejects(registry.invoke('send_email',{},context()),expectCode('AGENT_TOOL_FORBIDDEN'));
  assert.deepEqual(registry.listForAgent(identity()),[]);
});

test('stage04: read, analyze, prepare tools validate and enforce independently', async () => {
  const registry=new AgentToolRegistry();
  for (const capability of ['read','analyze','prepare']) {
    registry.register({name:`do_${capability}`,capability,permittedAgents:['resume'],parse(raw){if(typeof raw!=='string')throw Error('invalid');return raw;},
      authorize(input,ctx){if(ctx.identity.access.kind!=='authenticated'||input!=='ok') throw Error('secret');},execute:x=>x});
    assert.equal(await registry.invoke(`do_${capability}`,'ok',context()),'ok');
    await assert.rejects(registry.invoke(`do_${capability}`,9,context()),expectCode('AGENT_TOOL_INPUT_INVALID'));
    await assert.rejects(registry.invoke(`do_${capability}`,'not-allowed',context()),expectCode('AGENT_TOOL_FORBIDDEN'));
  }
  assert.deepEqual(registry.listForAgent(identity()),['do_read','do_analyze','do_prepare']);
  assert.deepEqual(registry.listForAgent(identity(userId,'ats')),[]);
});

test('stage04: public demo cannot invoke analysis, prepare, write or private read', async () => {
  const registry=new AgentToolRegistry();
  registry.register({name:'public_read',capability:'read',publicDemo:true,permittedAgents:['demo'],parse:x=>x,authorize:()=>{},execute:()=>42});
  registry.register({name:'private_read',capability:'read',permittedAgents:['demo'],parse:x=>x,authorize:()=>{},execute:()=>21});
  const demo={...context(),identity:{runId:randomUUID(),agentId:'demo',access:{kind:'public_demo'}}};
  assert.equal(await registry.invoke('public_read',{},demo),42);
  await assert.rejects(registry.invoke('private_read',{},demo),expectCode('AGENT_TOOL_FORBIDDEN'));
  assert.deepEqual(registry.listForAgent(demo.identity),['public_read']);
});

test('stage04: tool authorization/provider exceptions are sanitized; cancellation blocks execution', async () => {
  const registry=new AgentToolRegistry();
  registry.register({name:'break_action',capability:'read',permittedAgents:['resume'],parse:x=>x,authorize:()=>{},execute(){throw Error('MY_SECRET_DB_URL');}});
  await assert.rejects(registry.invoke('break_action',{},context()),expectCode('AGENT_STEP_FAILED'));
  const aborted=new AbortController();aborted.abort();
  await assert.rejects(registry.invoke('break_action',{}, {...context(),signal:aborted.signal}),expectCode('AGENT_CANCELLED'));
});

test('stage04: model gateway charges quota once per model request and reuses configured model port', async () => {
  let reservations=0, loads=0, calls=0;
  const gateway=createAgentModelGateway({
    loadModel: async structured=>{loads++;return {structured};},
    reserveQuota:async(actorId,feature)=>{assert.equal(actorId,userId);assert.equal(feature,'CAREER_ASSISTANT');reservations++;},
    generateText:async(model,req)=>{assert.equal(model.structured,false);calls++;return req.prompt.toUpperCase();},
    generateObject:async(model)=>{assert.equal(model.structured,true);calls++;return {result:3};},
  });
  const req={feature:'CAREER_ASSISTANT',system:'You are helpful.',prompt:'Hello'};
  assert.equal(await gateway.text(identity(),req,signal),'HELLO');
  const output=await gateway.object(identity(),req,{parse(x){if(typeof x?.result!=='number')throw Error('bad');return x;}},signal);
  assert.deepEqual(output,{result:3});
  assert.equal(reservations,2);assert.equal(loads,2);assert.equal(calls,2);
});

test('stage04: model gateway rejects anonymous, huge or invalid prompts without charging quota', async () => {
  let reservations=0;
  const gateway=createAgentModelGateway({loadModel:async()=>1,reserveQuota:async()=>{reservations++;},
    generateText:async()=>'',generateObject:async()=>({})});
  const req={feature:'GENERAL',system:'system',prompt:'hello'};
  await assert.rejects(gateway.text({runId:randomUUID(),agentId:'demo',access:{kind:'public_demo'}},req,signal),expectCode('AGENT_ACCESS_DENIED'));
  await assert.rejects(gateway.text(identity(),{...req,prompt:'a'.repeat(60_001)},signal),expectCode('AGENT_MODEL_INPUT_INVALID'));
  await assert.rejects(gateway.text(identity(),{...req,maxTokens:90000},signal),expectCode('AGENT_MODEL_INPUT_INVALID'));
  await assert.rejects(gateway.text(identity(),{...req,feature:'CUSTOM_UNBILLED'},signal),expectCode('AGENT_MODEL_INPUT_INVALID'));
  assert.equal(reservations,0);
});

test('stage04: quota rejection prevents model calls; provider errors never leak', async () => {
  let callCount=0;
  const blocked=createAgentModelGateway({loadModel:async()=>1,reserveQuota:async()=>{throw new AgenticError('AGENT_MODEL_QUOTA_DENIED',429);},
    generateText:async()=>{callCount++;return '';},generateObject:async()=>({})});
  const req={feature:'GENERAL',system:'system',prompt:'hello'};
  await assert.rejects(blocked.text(identity(),req,signal),expectCode('AGENT_MODEL_QUOTA_DENIED'));
  assert.equal(callCount,0);
  const errored=createAgentModelGateway({loadModel:async()=>1,reserveQuota:async()=>{},
    generateText:async()=>{throw Error('PROVIDER_SECRET_KEY');},generateObject:async()=>({})});
  try{await errored.text(identity(),req,signal);assert.fail('should fail');}catch(e){assert.equal(e.message,'AGENT_MODEL_UNAVAILABLE');}
});

test('stage04: schema validation happens before returning structured model data', async () => {
  const gateway=createAgentModelGateway({loadModel:async()=>1,reserveQuota:async()=>{},
    generateText:async()=>'',generateObject:async()=>({bad:'unverified'})});
  await assert.rejects(gateway.object(identity(),{feature:'GENERAL',system:'sys',prompt:'hi'},
    {parse(x){if(!('name' in x))throw Error('PRIVATE_PROVIDER_OUTPUT');return x;}},signal),expectCode('AGENT_MODEL_UNAVAILABLE'));
});
