/** Dependency-free focused regression tests. Full LangGraph/provider tests require npm install. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
let ts;
try {ts = require('typescript');} catch {ts = require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}
const root = path.resolve(__dirname,'..');
const source = rel => fs.readFileSync(path.join(root,rel),'utf8');
function load(rel,mocks={}) {
  const code=ts.transpileModule(source(rel),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const mod={exports:{}};
  new Function('require','module','exports',code)((key)=>{
    if(Object.prototype.hasOwnProperty.call(mocks,key))return mocks[key];
    throw Error(`Unexpected dependency: ${key} in ${rel}`);
  },mod,mod.exports);
  return mod.exports;
}
class ProfileError extends Error {constructor(status,code){super(code);this.status=status;this.code=code;}}
class AgenticError extends Error {constructor(code,status=500){super(code);this.code=code;this.status=status;}}
const m=load('src/lib/agentic/agents/resume/agent/errors.ts', {
  '@/lib/career-profile/http':{ProfileError,profileAIError:()=>new ProfileError(502,'AI_FAILED')},
  '../../../core/errors.ts':{AgenticError},
});
for(const [provider,internal,external] of [
  ['AI_INVALID_RESPONSE','AGENT_MODEL_INVALID_RESPONSE','AI_INVALID_RESPONSE'],
  ['AI_AUTH_ERROR','AGENT_MODEL_AUTH_FAILED','AI_AUTH_ERROR'],
  ['AI_RATE_LIMIT','AGENT_MODEL_RATE_LIMITED','AI_RATE_LIMIT'],
  ['AI_MODEL_UNAVAILABLE','AGENT_MODEL_NOT_FOUND','AI_MODEL_UNAVAILABLE'],
  ['AI_TIMEOUT','AGENT_DEADLINE_EXCEEDED','AI_TIMEOUT'],
  ['AI_LIMIT','AGENT_MODEL_QUOTA_DENIED','AI_LIMIT'],
]) {
  test(`Resume provider ${provider} retains actionable error category`,()=>{
    const original=new ProfileError(502,provider);
    const agent=m.resumeProviderAgentError(original);
    assert.equal(agent.code,internal);
    const api=m.resumeAgentApiError(agent);
    assert.equal(api.code,external);
    assert.notEqual(api.code,'AI_FAILED');
    assert.ok(!JSON.stringify(api).includes('PRIVATE_CV_TEXT'));
  });
}
test('Graph runtime failure is distinguishable from a provider failure',()=>{
  const failure=m.resumeAgentApiError(new AgenticError('AGENT_RUN_FAILED',502));
  assert.equal(failure.code,'AI_AGENT_ERROR');
});
test('Oversized resume context returns a specific 413 instead of AI_FAILED',()=>{
  const failure=m.resumeAgentApiError(m.resumeProviderAgentError(new ProfileError(413,'AI_CONTEXT_TOO_LARGE')));
  assert.equal(failure.status,413);
  assert.equal(failure.code,'AI_CONTEXT_TOO_LARGE');
});
const tool=load('src/lib/agentic/agents/resume/tools/generate-edit.tool.ts',{
  '../../../core/errors.ts':{AgenticError},
  '../agent/errors':m,
});
const identity={agentId:'resume',access:{kind:'authenticated',actorId:'test-user'}};
const input={document:{title:'Engineer'},instruction:'Change title to AI Engineer',language:'en',profileFacts:[],linkedJobAdvert:null};
const signal=new AbortController().signal;
test('Successful draft reserves quota once and does not change the original CV',async()=>{
  let calls=0,generated=0;
  const draft={object:{status:'applied',message:'Updated',summary:[],edits:[]},document:null};
  const result=await tool.generateResumeEditTool(identity,input,{
    reserveQuota:async()=>{calls++;},
    generate:async(args)=>{generated++;assert.equal(args.instruction,input.instruction);return draft;},
  },signal);
  assert.equal(result,draft);assert.equal(generated,1);assert.equal(calls,1);assert.equal(input.document.title,'Engineer');
});
test('Quota denied never calls provider',async()=>{
  let calls=0;
  await assert.rejects(tool.generateResumeEditTool(identity,input,{
    reserveQuota:async()=>{throw new ProfileError(429,'AI_LIMIT');},
    generate:async()=>{calls++;throw Error('must not call');},
  },signal),e=>e.code==='AGENT_MODEL_QUOTA_DENIED');
  assert.equal(calls,0);
});
test('Bad model JSON is not conflated with unavailability',async()=>{
  await assert.rejects(tool.generateResumeEditTool(identity,input,{
    reserveQuota:async()=>{},
    generate:async()=>{throw new ProfileError(502,'AI_INVALID_RESPONSE');},
  },signal),e=>e.code==='AGENT_MODEL_INVALID_RESPONSE');
});
test('Editor still validates strict operations and keeps user confirmation',()=>{
  const src=source('src/lib/resume-conversation-ai.ts');
  const route=source('src/app/api/cvs/[id]/assistant/route.ts');
  assert.match(src,/generateText\(/);
  assert.match(src,/schema\.parse\(normalizeResumeModelObject\(raw\)\)/);
  assert.doesNotMatch(src,/generateObject\(/);
  assert.match(src,/applyResumeConversationEdits/);
  assert.match(route,/proposeResumeAI/);
  assert.doesNotMatch(route,/\.cv\.update\(/);
  assert.match(source('src/lib/agentic/agents/resume/nodes/verify.node.ts'),/AGENT_MODEL_INVALID_RESPONSE/);
});
test('Editor does not blame users for provider failures',()=>{
  const src=source('src/lib/resume-editor-copy.ts');
  assert.doesNotMatch(src,/Writing failed\. Try again with more specific facts\./);
});
